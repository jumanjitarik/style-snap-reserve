
-- Fix 1: allow anon to execute has_role (used inside RLS USING clauses on anon-readable tables)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;

-- Fix 2: let service role / pending_payment cancellations bypass the 24h rule
CREATE OR REPLACE FUNCTION public.validate_appointment_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_day integer;
  v_time time;
  v_hours record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.starts_at < (date_trunc('day', now()) + INTERVAL '1 day') THEN
      RAISE EXCEPTION 'Randevu en erken yarın için alınabilir.';
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
    -- Bypass 24h cancel rule for:
    --  * service role / background jobs (auth.uid() IS NULL)
    --  * appointments still awaiting payment (pending_payment) - must be releasable on payment failure/abandon
    IF auth.uid() IS NOT NULL
       AND OLD.status <> 'pending_payment'
       AND OLD.starts_at < now() + INTERVAL '24 hours' THEN
      RAISE EXCEPTION '24 saat kala iptal sağlanmamaktadır';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
