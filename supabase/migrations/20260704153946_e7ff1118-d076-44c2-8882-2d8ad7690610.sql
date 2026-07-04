
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS points_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_earned INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0;

-- Loyalty + points bakiyesi güncelleme
CREATE OR REPLACE FUNCTION public.apply_membership_loyalty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  earn integer;
  v_pct numeric;
  v_setting text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT value INTO v_setting FROM public.app_settings WHERE key = 'loyalty_percent';
    BEGIN
      v_pct := COALESCE(NULLIF(v_setting, '')::numeric, 1);
    EXCEPTION WHEN OTHERS THEN v_pct := 1;
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
$$;

DROP TRIGGER IF EXISTS memberships_apply_loyalty ON public.memberships;
CREATE TRIGGER memberships_apply_loyalty
  BEFORE INSERT ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.apply_membership_loyalty();

-- Bildirim tetikleyicisi
CREATE OR REPLACE FUNCTION public.notify_membership_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_name text;
  v_owner uuid;
  v_admin record;
BEGIN
  SELECT name, owner_id INTO v_shop_name, v_owner FROM public.barbershops WHERE id = NEW.shop_id;

  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, body)
    VALUES (NEW.user_id, 'Üyelik onaylandı', v_shop_name || ' · ' || COALESCE(NEW.payment_amount + NEW.remaining_amount, NEW.amount)::text || '₺ üyelik satın alındı');
  END IF;

  IF v_owner IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, body)
    VALUES (v_owner, 'Yeni üyelik satışı', v_shop_name || ' · ' || COALESCE(NEW.payment_amount, 0)::text || '₺ kart / ' || COALESCE(NEW.remaining_amount, 0)::text || '₺ salonda');
  END IF;

  FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications(user_id, title, body)
    VALUES (v_admin.user_id, 'Yeni üyelik (admin)', v_shop_name || ' · ' || COALESCE(NEW.amount, 0)::text || '₺');
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS memberships_notify ON public.memberships;
CREATE TRIGGER memberships_notify
  AFTER INSERT ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.notify_membership_created();

REVOKE EXECUTE ON FUNCTION public.apply_membership_loyalty() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_membership_created() FROM PUBLIC, anon, authenticated;
