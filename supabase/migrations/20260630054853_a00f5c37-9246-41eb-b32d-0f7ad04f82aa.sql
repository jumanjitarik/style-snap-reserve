-- Make role checking safe for RLS policies and triggers without requiring callers to access private schema.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
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

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Required table permissions for authenticated app users; RLS below still scopes access.
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbershops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_working_hours TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.virtual_pos_charges TO authenticated;
GRANT SELECT ON public.profiles, public.user_roles, public.appointments, public.barbershops, public.services, public.staff, public.shop_working_hours, public.virtual_pos_charges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.user_roles, public.appointments, public.barbershops, public.services, public.staff, public.shop_working_hours, public.virtual_pos_charges TO service_role;

-- Profiles: users can always see/update themselves; admins can see/update all.
DROP POLICY IF EXISTS "users view own profile" ON public.profiles;
CREATE POLICY "users view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admins view all profiles" ON public.profiles;
CREATE POLICY "admins view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins update all profiles" ON public.profiles;
CREATE POLICY "admins update all profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- User roles: users see their own roles; admins manage assignments.
DROP POLICY IF EXISTS "users see own roles" ON public.user_roles;
CREATE POLICY "users see own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "only admins insert roles" ON public.user_roles;
CREATE POLICY "only admins insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "only admins update roles" ON public.user_roles;
CREATE POLICY "only admins update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "only admins delete roles" ON public.user_roles;
CREATE POLICY "only admins delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Appointments: authenticated users can create their own appointment; owners/staff/admins can read shop appointments.
DROP POLICY IF EXISTS "Anyone can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "users create own appts" ON public.appointments;
CREATE POLICY "users create own appts"
ON public.appointments FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "users see own appts" ON public.appointments;
CREATE POLICY "users see own appts"
ON public.appointments FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = appointments.shop_id AND s.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.staff st WHERE st.shop_id = appointments.shop_id AND st.user_id = auth.uid())
);

DROP POLICY IF EXISTS "users update own appts" ON public.appointments;
CREATE POLICY "users update own appts"
ON public.appointments FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = appointments.shop_id AND s.owner_id = auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = appointments.shop_id AND s.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "users delete own appts" ON public.appointments;
CREATE POLICY "users delete own appts"
ON public.appointments FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = appointments.shop_id AND s.owner_id = auth.uid())
);

-- Shop management policies.
DROP POLICY IF EXISTS "admin or owner manage shops" ON public.barbershops;
CREATE POLICY "admin or owner manage shops"
ON public.barbershops FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR auth.uid() = owner_id)
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR auth.uid() = owner_id);

DROP POLICY IF EXISTS "admin or owner manage services" ON public.services;
CREATE POLICY "admin or owner manage services"
ON public.services FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = services.shop_id AND s.owner_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = services.shop_id AND s.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "admin or owner manage staff" ON public.staff;
CREATE POLICY "admin or owner manage staff"
ON public.staff FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = staff.shop_id AND s.owner_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = staff.shop_id AND s.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "admin or owner manage shop working hours" ON public.shop_working_hours;
CREATE POLICY "admin or owner manage shop working hours"
ON public.shop_working_hours FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = shop_working_hours.shop_id AND s.owner_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = shop_working_hours.shop_id AND s.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "admin or owner manage virtual pos charges" ON public.virtual_pos_charges;
CREATE POLICY "admin or owner manage virtual pos charges"
ON public.virtual_pos_charges FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = virtual_pos_charges.shop_id AND s.owner_id = auth.uid())
)
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = virtual_pos_charges.shop_id AND s.owner_id = auth.uid())
  )
);

-- Function used by owner/staff appointment list for customer basics.
CREATE OR REPLACE FUNCTION public.get_customer_basics(_ids uuid[])
RETURNS TABLE(id uuid, full_name text, phone text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.phone, p.email
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.appointments a
        JOIN public.barbershops s ON s.id = a.shop_id
        WHERE a.user_id = p.id AND s.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.appointments a
        JOIN public.staff st ON st.shop_id = a.shop_id
        WHERE a.user_id = p.id AND st.user_id = auth.uid()
      )
    );
$$;
REVOKE ALL ON FUNCTION public.get_customer_basics(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_basics(uuid[]) TO authenticated, service_role;

-- Storage policies for visible images and authenticated uploads to own folder.
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;
GRANT ALL ON storage.objects TO service_role;

DROP POLICY IF EXISTS "Public read barbershop photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read barbershop-photos" ON storage.objects;
DROP POLICY IF EXISTS "public read shop photos" ON storage.objects;
CREATE POLICY "Public read barbershop photos"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'barbershop-photos');

DROP POLICY IF EXISTS "Owners staff or admin upload barbershop photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload barbershop photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload barbershop-photos" ON storage.objects;
DROP POLICY IF EXISTS "auth users upload shop photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload own barbershop photos" ON storage.objects;
CREATE POLICY "Authenticated users upload own barbershop photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'barbershop-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Owners admins update barbershop photos" ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin update barbershop photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth update barbershop photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update barbershop-photos" ON storage.objects;
DROP POLICY IF EXISTS "auth users update shop photos" ON storage.objects;
CREATE POLICY "Owners admins update barbershop photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'barbershop-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.owner_id = auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'barbershop-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.owner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Owners admins delete barbershop photos" ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin delete barbershop photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete barbershop photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete barbershop-photos" ON storage.objects;
DROP POLICY IF EXISTS "auth users delete shop photos" ON storage.objects;
CREATE POLICY "Owners admins delete barbershop photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'barbershop-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.owner_id = auth.uid())
  )
);