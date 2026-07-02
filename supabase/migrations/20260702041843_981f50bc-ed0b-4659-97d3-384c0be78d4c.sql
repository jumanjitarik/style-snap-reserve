
ALTER TABLE public.barbershops
  ADD COLUMN IF NOT EXISTS allow_full_payment boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_deposit_payment boolean NOT NULL DEFAULT true;

INSERT INTO public.app_settings (key, value)
VALUES ('deposit_percent', '25')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.compute_appointment_amounts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric := 0;
  v_discount numeric := 0;
  v_code public.discount_codes%ROWTYPE;
  v_user_points int := 0;
  v_points_used int := COALESCE(NEW.points_used, 0);
  v_after numeric;
  v_final numeric;
  v_pct numeric := 25;
  v_setting text;
BEGIN
  IF NEW.service_ids IS NOT NULL AND array_length(NEW.service_ids, 1) > 0 THEN
    SELECT COALESCE(SUM(price), 0) INTO v_total FROM public.services WHERE id = ANY(NEW.service_ids);
  ELSE
    SELECT COALESCE(price, 0) INTO v_total FROM public.services WHERE id = NEW.service_id;
  END IF;

  IF NEW.discount_code IS NOT NULL AND NEW.discount_code <> '' THEN
    SELECT * INTO v_code FROM public.discount_codes
      WHERE code = NEW.discount_code AND active = true
        AND (expires_at IS NULL OR expires_at > now());
    IF FOUND THEN
      v_discount := CASE WHEN v_code.discount_type = 'percent'
        THEN v_total * v_code.discount_value / 100
        ELSE v_code.discount_value END;
      v_discount := LEAST(v_discount, v_total);
    ELSE
      v_discount := 0;
      NEW.discount_code := NULL;
    END IF;
  END IF;

  v_after := GREATEST(0, v_total - v_discount);

  IF NEW.user_id IS NOT NULL AND v_points_used > 0 THEN
    SELECT COALESCE(points, 0) INTO v_user_points FROM public.profiles WHERE id = NEW.user_id;
    v_points_used := LEAST(v_points_used, v_user_points, FLOOR(v_after)::int);
  ELSE
    v_points_used := 0;
  END IF;

  v_final := GREATEST(0, v_after - v_points_used);

  SELECT value INTO v_setting FROM public.app_settings WHERE key = 'deposit_percent';
  BEGIN
    v_pct := COALESCE(NULLIF(v_setting, '')::numeric, 25);
  EXCEPTION WHEN OTHERS THEN
    v_pct := 25;
  END;
  IF v_pct < 0 THEN v_pct := 0; END IF;
  IF v_pct > 100 THEN v_pct := 100; END IF;

  NEW.discount_amount := v_discount;
  NEW.points_used := v_points_used;

  IF NEW.payment_method = 'deposit' THEN
    NEW.deposit_amount := ROUND(v_final * v_pct / 100);
    NEW.remaining_amount := GREATEST(0, v_final - NEW.deposit_amount);
    NEW.payment_amount := NEW.deposit_amount;
  ELSE
    NEW.deposit_amount := v_final;
    NEW.remaining_amount := 0;
    NEW.payment_amount := v_final;
  END IF;

  RETURN NEW;
END;
$function$;
