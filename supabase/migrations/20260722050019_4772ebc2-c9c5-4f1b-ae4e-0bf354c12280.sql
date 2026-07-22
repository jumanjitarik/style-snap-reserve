
CREATE OR REPLACE FUNCTION public.validate_appointment_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_day integer;
  v_time time;
  v_hours record;
  v_priv boolean;
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
    -- Admin ve salon sahibi her zaman iptal edebilir
    v_priv := auth.uid() IS NULL
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = NEW.shop_id AND s.owner_id = auth.uid());
    IF NOT v_priv
       AND OLD.status <> 'pending_payment'
       AND OLD.starts_at < now() + INTERVAL '24 hours' THEN
      RAISE EXCEPTION '24 saat kala iptal sağlanmamaktadır';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fill in default cover images for shops without one
UPDATE public.barbershops
SET cover_image_url = CASE category::text
  WHEN 'male_barber'   THEN 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1200&q=80'
  WHEN 'female_barber' THEN 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80'
  WHEN 'laser'         THEN 'https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=1200&q=80'
  WHEN 'nail'          THEN 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1200&q=80'
  WHEN 'skin'          THEN 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1200&q=80'
  WHEN 'aesthetic'     THEN 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&q=80'
  WHEN 'spa_massage'   THEN 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200&q=80'
  WHEN 'yoga_pilates'  THEN 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1200&q=80'
  WHEN 'fitness'       THEN 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80'
  WHEN 'slimming'      THEN 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200&q=80'
  WHEN 'estetik'       THEN 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=1200&q=80'
  WHEN 'dis_bakimi'    THEN 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1200&q=80'
  WHEN 'diyet'         THEN 'https://images.unsplash.com/photo-1547592180-85f173990554?w=1200&q=80'
  ELSE 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80'
END
WHERE cover_image_url IS NULL OR cover_image_url = '';
