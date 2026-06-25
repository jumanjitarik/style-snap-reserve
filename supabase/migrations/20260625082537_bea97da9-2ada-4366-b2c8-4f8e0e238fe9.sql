
CREATE OR REPLACE FUNCTION public.validate_appointment_time()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.starts_at < (date_trunc('day', now()) + INTERVAL '1 day') THEN
    RAISE EXCEPTION 'Randevu en erken yarın için alınabilir.';
  END IF;
  RETURN NEW;
END;
$$;
