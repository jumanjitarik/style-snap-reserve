
ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS max_uses INTEGER,
  ADD COLUMN IF NOT EXISTS per_user_limit INTEGER;

CREATE OR REPLACE FUNCTION public.validate_discount_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code public.discount_codes%ROWTYPE;
  v_total INTEGER;
  v_user INTEGER;
BEGIN
  IF NEW.discount_code IS NULL OR NEW.discount_code = '' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_code FROM public.discount_codes WHERE code = NEW.discount_code AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Geçersiz veya pasif indirim kodu';
  END IF;
  IF v_code.max_uses IS NOT NULL THEN
    SELECT count(*) INTO v_total FROM public.appointments
      WHERE discount_code = NEW.discount_code AND status <> 'cancelled';
    IF v_total >= v_code.max_uses THEN
      RAISE EXCEPTION 'Kupon kullanım limiti doldu';
    END IF;
  END IF;
  IF v_code.per_user_limit IS NOT NULL AND NEW.user_id IS NOT NULL THEN
    SELECT count(*) INTO v_user FROM public.appointments
      WHERE discount_code = NEW.discount_code AND user_id = NEW.user_id AND status <> 'cancelled';
    IF v_user >= v_code.per_user_limit THEN
      RAISE EXCEPTION 'Bu kuponu kullanım hakkınız doldu';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_discount ON public.appointments;
CREATE TRIGGER trg_validate_discount
  BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.validate_discount_usage();
