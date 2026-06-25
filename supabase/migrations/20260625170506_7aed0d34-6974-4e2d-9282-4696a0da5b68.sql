
-- 1. Owner block flag + city for profiles (city helps "bulunduğu il" filtering)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS city text;

-- 2. Google Maps link on shops + city column for il-based filtering
ALTER TABLE public.barbershops
  ADD COLUMN IF NOT EXISTS maps_url text,
  ADD COLUMN IF NOT EXISTS city text;

-- 3. Multi-service support on appointments (additive — keep service_id for backward compat)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service_ids uuid[];

-- 4. Notifications enrichment for broadcast
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS link_url text;

-- 5. Server-side broadcast helper (admin-only). Inserts a notification row per
-- targeted user. Audience: 'all' | 'customers' | 'owners' | 'staff' | 'others'
CREATE OR REPLACE FUNCTION public.admin_broadcast(
  _title text,
  _body text,
  _image_url text,
  _link_url text,
  _audience text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_count int := 0;
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'Yetkisiz';
  END IF;

  WITH targets AS (
    SELECT p.id AS user_id FROM public.profiles p
    WHERE
      _audience = 'all'
      OR (_audience = 'owners' AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'owner'))
      OR (_audience = 'staff' AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'staff'))
      OR (_audience = 'customers' AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'customer'))
      OR (_audience = 'others' AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role IN ('owner','staff')))
  )
  INSERT INTO public.notifications(user_id, title, body, image_url, link_url)
  SELECT user_id, _title, _body, _image_url, _link_url FROM targets;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_broadcast(text, text, text, text, text) TO authenticated;

-- 6. Profile RLS: respect is_blocked — blocked users cannot create appointments
-- Block enforcement via trigger (avoids touching existing RLS policies):
CREATE OR REPLACE FUNCTION public.block_appointments_for_blocked()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.user_id AND is_blocked = true) THEN
      RAISE EXCEPTION 'Hesabınız engellenmiştir. Lütfen destek ile iletişime geçin.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_appointments ON public.appointments;
CREATE TRIGGER trg_block_appointments
  BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.block_appointments_for_blocked();
