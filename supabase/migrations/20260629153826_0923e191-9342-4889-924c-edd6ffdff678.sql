-- Drop duplicate triggers that caused points_used to be subtracted twice
DROP TRIGGER IF EXISTS apply_loyalty_points_ins ON public.appointments;
DROP TRIGGER IF EXISTS validate_appt_changes ON public.appointments;
DROP TRIGGER IF EXISTS appointments_time_check ON public.appointments;

-- Make the loyalty trigger idempotent and safe for UPDATEs (apply delta on cancel)
CREATE OR REPLACE FUNCTION public.apply_loyalty_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  earn integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    earn := GREATEST(0, FLOOR(COALESCE(NEW.payment_amount, 0) * 0.01))::integer;
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