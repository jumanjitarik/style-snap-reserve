ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS points_earned integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_used integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.apply_loyalty_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  earn integer;
BEGIN
  earn := GREATEST(0, FLOOR(COALESCE(NEW.payment_amount, 0) * 0.01))::integer;
  NEW.points_earned := earn;

  IF NEW.user_id IS NOT NULL THEN
    UPDATE public.profiles
      SET points = GREATEST(0, COALESCE(points, 0) + earn - COALESCE(NEW.points_used, 0))
      WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_loyalty_points() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_loyalty_points() FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_loyalty_points() FROM authenticated;

DROP TRIGGER IF EXISTS trg_apply_loyalty_points ON public.appointments;
CREATE TRIGGER trg_apply_loyalty_points
  BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.apply_loyalty_points();

INSERT INTO public.app_settings (key, value) VALUES
  ('search_placeholder', 'Berber, salon, hizmet ara…'),
  ('gallery_interval_ms', '5000')
ON CONFLICT (key) DO NOTHING;