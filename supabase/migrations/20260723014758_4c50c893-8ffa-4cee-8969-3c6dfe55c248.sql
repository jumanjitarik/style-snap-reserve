
CREATE OR REPLACE FUNCTION public.validate_appointment_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_day integer;
  v_time time;
  v_hours record;
  v_is_admin boolean;
  v_is_owner boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- En az 2 saat sonrası için randevu alınabilir
    IF NEW.starts_at < now() + INTERVAL '2 hours' THEN
      RAISE EXCEPTION 'Randevu en erken 2 saat sonrası için alınabilir.';
    END IF;

    v_day := EXTRACT(DOW FROM (NEW.starts_at AT TIME ZONE 'Europe/Istanbul'))::integer;
    v_time := (NEW.starts_at AT TIME ZONE 'Europe/Istanbul')::time;

    SELECT is_open, open_time, close_time INTO v_hours
    FROM public.shop_working_hours
    WHERE shop_id = NEW.shop_id AND weekday = v_day;

    IF FOUND THEN
      IF NOT v_hours.is_open THEN
        RAISE EXCEPTION 'Seçilen gün salon kapalı.';
      END IF;
      IF v_time < v_hours.open_time OR v_time >= v_hours.close_time THEN
        RAISE EXCEPTION 'Seçilen saat salon çalışma saatleri dışında.';
      END IF;
    ELSIF v_day = 0 THEN
      RAISE EXCEPTION 'Pazar günleri randevu alınamaz.';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    -- Arka plan (service role) her zaman iptal edebilir
    IF auth.uid() IS NULL THEN RETURN NEW; END IF;

    v_is_admin := public.has_role(auth.uid(), 'admin'::public.app_role);
    v_is_owner := EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = NEW.shop_id AND s.owner_id = auth.uid());

    -- Admin: sınırsız iptal
    IF v_is_admin THEN RETURN NEW; END IF;

    -- Salon sahibi ve çalışanı iptal edemez
    IF v_is_owner OR EXISTS (
      SELECT 1 FROM public.staff st WHERE st.shop_id = NEW.shop_id AND st.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Randevu iptali yalnızca müşteri veya admin tarafından yapılabilir.';
    END IF;

    -- Müşteri: kendi randevusu ve en az 2 saat kala
    IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Bu randevuyu iptal etme yetkiniz yok.';
    END IF;
    IF OLD.status <> 'pending_payment' AND OLD.starts_at < now() + INTERVAL '2 hours' THEN
      RAISE EXCEPTION 'Randevuya 2 saatten az kaldığı için iptal edilemez.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
