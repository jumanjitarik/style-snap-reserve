CREATE OR REPLACE FUNCTION public.apply_loyalty_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  earn integer;
  v_pct numeric;
  v_setting text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT value INTO v_setting FROM public.app_settings WHERE key = 'loyalty_percent';
    BEGIN
      v_pct := COALESCE(NULLIF(v_setting, '')::numeric, 1);
    EXCEPTION WHEN OTHERS THEN
      v_pct := 1;
    END;
    IF v_pct < 0 THEN v_pct := 0; END IF;
    earn := GREATEST(0, FLOOR(COALESCE(NEW.payment_amount, 0) * v_pct / 100))::integer;
    NEW.points_earned := earn;
    IF NEW.user_id IS NOT NULL THEN
      UPDATE public.profiles
        SET points = GREATEST(0, COALESCE(points, 0) + earn - COALESCE(NEW.points_used, 0))
        WHERE id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;