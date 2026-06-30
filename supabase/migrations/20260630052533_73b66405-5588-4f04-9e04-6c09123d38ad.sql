-- Fix role helper and policies that still referenced the blocked public helper
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

-- Keep public.has_role callable for legacy app code/RLS predicates, but safe because it delegates
-- to the locked-down private security-definer helper instead of reading user_roles directly.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.has_role(_user_id, _role)
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Replace policies that still call public.has_role with private.has_role.
DROP POLICY IF EXISTS ann_admin_all ON public.announcements;
CREATE POLICY ann_admin_all
ON public.announcements
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS settings_admin_write ON public.app_settings;
CREATE POLICY settings_admin_write
ON public.app_settings
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin or owner manage images" ON public.barbershop_images;
CREATE POLICY "admin or owner manage images"
ON public.barbershop_images
FOR ALL
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.barbershops s
    WHERE s.id = barbershop_images.shop_id AND s.owner_id = auth.uid()
  )
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.barbershops s
    WHERE s.id = barbershop_images.shop_id AND s.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins manage codes" ON public.discount_codes;
CREATE POLICY "Admins manage codes"
ON public.discount_codes
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS translations_admin_delete ON public.translations;
CREATE POLICY translations_admin_delete
ON public.translations
FOR DELETE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS translations_admin_insert ON public.translations;
CREATE POLICY translations_admin_insert
ON public.translations
FOR INSERT
TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS translations_admin_update ON public.translations;
CREATE POLICY translations_admin_update
ON public.translations
FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS act_admin_read ON public.user_activity;
CREATE POLICY act_admin_read
ON public.user_activity
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR auth.uid() = user_id);

-- Storage policies must not call the blocked public role helper.
DROP POLICY IF EXISTS "Owners admins delete barbershop photos" ON storage.objects;
CREATE POLICY "Owners admins delete barbershop photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'barbershop-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.owner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Owners admins update barbershop photos" ON storage.objects;
CREATE POLICY "Owners admins update barbershop photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'barbershop-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.owner_id = auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'barbershop-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.owner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Owners staff or admin upload barbershop photos" ON storage.objects;
CREATE POLICY "Owners staff or admin upload barbershop photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'barbershop-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff st WHERE st.user_id = auth.uid())
    OR NOT EXISTS (SELECT 1 FROM storage.objects existing WHERE existing.bucket_id = 'barbershop-photos' AND existing.name = storage.objects.name)
  )
);

-- Authenticated users need their own role/profile data for UI visibility.
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_roles TO service_role;

-- Add shop working hours for owner/admin management.
CREATE TABLE IF NOT EXISTS public.shop_working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  weekday integer NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  is_open boolean NOT NULL DEFAULT true,
  open_time time NOT NULL DEFAULT '09:00',
  close_time time NOT NULL DEFAULT '19:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, weekday),
  CHECK (open_time < close_time)
);
GRANT SELECT ON public.shop_working_hours TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_working_hours TO authenticated;
GRANT ALL ON public.shop_working_hours TO service_role;
ALTER TABLE public.shop_working_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone view shop working hours" ON public.shop_working_hours;
CREATE POLICY "anyone view shop working hours"
ON public.shop_working_hours
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "admin or owner manage shop working hours" ON public.shop_working_hours;
CREATE POLICY "admin or owner manage shop working hours"
ON public.shop_working_hours
FOR ALL
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = shop_working_hours.shop_id AND s.owner_id = auth.uid())
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = shop_working_hours.shop_id AND s.owner_id = auth.uid())
);

DROP TRIGGER IF EXISTS set_shop_working_hours_updated_at ON public.shop_working_hours;
CREATE TRIGGER set_shop_working_hours_updated_at
BEFORE UPDATE ON public.shop_working_hours
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add manual virtual POS charges created by salon owners/admins.
CREATE TABLE IF NOT EXISTS public.virtual_pos_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  service_ids uuid[] NOT NULL DEFAULT '{}',
  description text,
  amount numeric NOT NULL CHECK (amount >= 0),
  customer_name text,
  customer_phone text,
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','cancelled','refunded')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.virtual_pos_charges TO authenticated;
GRANT ALL ON public.virtual_pos_charges TO service_role;
ALTER TABLE public.virtual_pos_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin or owner manage virtual pos charges" ON public.virtual_pos_charges;
CREATE POLICY "admin or owner manage virtual pos charges"
ON public.virtual_pos_charges
FOR ALL
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = virtual_pos_charges.shop_id AND s.owner_id = auth.uid())
)
WITH CHECK (
  created_by = auth.uid()
  AND (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = virtual_pos_charges.shop_id AND s.owner_id = auth.uid())
  )
);

-- Seed default Mon-Sat open / Sunday closed rows for existing shops.
INSERT INTO public.shop_working_hours (shop_id, weekday, is_open, open_time, close_time)
SELECT b.id, d.weekday, (d.weekday <> 0), '09:00'::time, '19:00'::time
FROM public.barbershops b
CROSS JOIN generate_series(0, 6) AS d(weekday)
ON CONFLICT (shop_id, weekday) DO NOTHING;

-- Ensure appointment validation follows salon working days/hours.
CREATE OR REPLACE FUNCTION public.validate_appointment_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_day integer;
  v_time time;
  v_hours record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.starts_at < (date_trunc('day', now()) + INTERVAL '1 day') THEN
      RAISE EXCEPTION 'Randevu en erken yarın için alınabilir.';
    END IF;

    v_day := EXTRACT(DOW FROM (NEW.starts_at AT TIME ZONE 'Europe/Istanbul'))::integer;
    v_time := (NEW.starts_at AT TIME ZONE 'Europe/Istanbul')::time;

    SELECT is_open, open_time, close_time INTO v_hours
    FROM public.shop_working_hours
    WHERE shop_id = NEW.shop_id AND weekday = v_day;

    IF FOUND THEN
      IF NOT v_hours.is_open THEN
        RAISE EXCEPTION 'Seçilen gün salon kapalı.';
      END IF;
      IF v_time < v_hours.open_time OR v_time >= v_hours.close_time THEN
        RAISE EXCEPTION 'Seçilen saat salon çalışma saatleri dışında.';
      END IF;
    ELSIF v_day = 0 THEN
      RAISE EXCEPTION 'Pazar günleri randevu alınamaz.';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    IF OLD.starts_at < now() + INTERVAL '24 hours' THEN
      RAISE EXCEPTION '24 saat kala iptal sağlanmamaktadır';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;