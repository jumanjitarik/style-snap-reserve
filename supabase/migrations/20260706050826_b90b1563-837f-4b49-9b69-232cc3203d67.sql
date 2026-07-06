-- Remove auto-block on multiple cancellations
CREATE OR REPLACE FUNCTION public.enforce_cancel_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Policy change: no longer auto-block users for multiple same-day cancellations.
  RETURN NEW;
END;
$function$;

-- Unblock all currently blocked profiles (including admin who got caught by old rule)
UPDATE public.profiles SET is_blocked = false WHERE is_blocked = true;