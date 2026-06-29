
-- Fitness category
ALTER TYPE public.shop_category ADD VALUE IF NOT EXISTS 'fitness';

-- Loyalty points on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;

-- Points earned/used per appointment + customer note (using existing notes col already exists, but ensure)
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS points_earned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS points_used INTEGER NOT NULL DEFAULT 0;
-- notes column already exists, ensure
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notes TEXT;

-- Trigger: award points = 1% of payment_amount on confirmed/completed; deduct points_used when inserted
CREATE OR REPLACE FUNCTION public.apply_loyalty_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_earn INTEGER := 0;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.user_id IS NOT NULL THEN
    -- Earn: 1% of cash collected by the system (payment_amount)
    v_earn := FLOOR(COALESCE(NEW.payment_amount, 0) * 0.01)::INTEGER;
    NEW.points_earned := v_earn;
    UPDATE public.profiles
       SET points = GREATEST(0, COALESCE(points, 0) + v_earn - COALESCE(NEW.points_used, 0))
     WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_loyalty_points_ins ON public.appointments;
CREATE TRIGGER apply_loyalty_points_ins
BEFORE INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.apply_loyalty_points();

REVOKE EXECUTE ON FUNCTION public.apply_loyalty_points() FROM PUBLIC, anon, authenticated;
