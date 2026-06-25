
-- Allow public read on barbershop-photos bucket so getPublicUrl works
DROP POLICY IF EXISTS "Public read barbershop photos" ON storage.objects;
CREATE POLICY "Public read barbershop photos" ON storage.objects FOR SELECT USING (bucket_id = 'barbershop-photos');

DROP POLICY IF EXISTS "Auth upload barbershop photos" ON storage.objects;
CREATE POLICY "Auth upload barbershop photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'barbershop-photos');

DROP POLICY IF EXISTS "Auth update barbershop photos" ON storage.objects;
CREATE POLICY "Auth update barbershop photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'barbershop-photos');

DROP POLICY IF EXISTS "Auth delete barbershop photos" ON storage.objects;
CREATE POLICY "Auth delete barbershop photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'barbershop-photos');

-- Sunday block + 3-cancellation-per-day auto-delete membership
CREATE OR REPLACE FUNCTION public.validate_appointment_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_cancels int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.starts_at < (date_trunc('day', now()) + INTERVAL '1 day') THEN
      RAISE EXCEPTION 'Randevu en erken yarın için alınabilir.';
    END IF;
    IF EXTRACT(DOW FROM (NEW.starts_at AT TIME ZONE 'Europe/Istanbul')) = 0 THEN
      RAISE EXCEPTION 'Pazar günleri randevu alınamaz.';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    IF OLD.starts_at < now() + INTERVAL '24 hours' THEN
      RAISE EXCEPTION 'Randevu sadece 24 saatten önce iptal edilebilir.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_appt_changes ON public.appointments;
CREATE TRIGGER validate_appt_changes BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_changes();

-- After-cancellation: count same-day cancels for user; if >=3 delete auth user (cascades)
CREATE OR REPLACE FUNCTION public.enforce_cancel_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count int;
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') AND NEW.user_id IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.appointments
      WHERE user_id = NEW.user_id AND status = 'cancelled'
        AND updated_at >= date_trunc('day', now());
    IF v_count >= 3 THEN
      DELETE FROM auth.users WHERE id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_cancel_limit_trg ON public.appointments;
CREATE TRIGGER enforce_cancel_limit_trg AFTER UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.enforce_cancel_limit();
