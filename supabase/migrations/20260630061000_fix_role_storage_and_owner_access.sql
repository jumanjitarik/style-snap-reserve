-- Final repair for role checks after private.has_role hardening.
-- RLS policies must call public.has_role (callable by authenticated users), not private.has_role.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Do not expose the private helper; remove direct-policy references by recreating affected policies.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'private' AND p.proname = 'has_role') THEN
    REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbershops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_working_hours TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.virtual_pos_charges TO authenticated;
GRANT SELECT ON public.profiles, public.user_roles, public.appointments, public.barbershops, public.services, public.staff, public.shop_working_hours TO anon;
GRANT ALL ON public.profiles, public.user_roles, public.appointments, public.barbershops, public.services, public.staff, public.shop_working_hours, public.virtual_pos_charges TO service_role;

DROP POLICY IF EXISTS "users view own profile" ON public.profiles;
CREATE POLICY "users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "admins view all profiles" ON public.profiles;
CREATE POLICY "admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "admins update all profiles" ON public.profiles;
CREATE POLICY "admins update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "users see own roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "only admins insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "only admins update roles" ON public.user_roles;
DROP POLICY IF EXISTS "only admins delete roles" ON public.user_roles;
CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "only admins insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "only admins update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "only admins delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin or owner manage shops" ON public.barbershops;
CREATE POLICY "admin or owner manage shops" ON public.barbershops FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR auth.uid() = owner_id)
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR auth.uid() = owner_id);

DROP POLICY IF EXISTS "admin or owner manage services" ON public.services;
CREATE POLICY "admin or owner manage services" ON public.services FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = services.shop_id AND s.owner_id = auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = services.shop_id AND s.owner_id = auth.uid()));

DROP POLICY IF EXISTS "admin or owner manage staff" ON public.staff;
CREATE POLICY "admin or owner manage staff" ON public.staff FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = staff.shop_id AND s.owner_id = auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = staff.shop_id AND s.owner_id = auth.uid()));

DROP POLICY IF EXISTS "users create own appts" ON public.appointments;
CREATE POLICY "users create own appts" ON public.appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
DROP POLICY IF EXISTS "users see own appts" ON public.appointments;
CREATE POLICY "users see own appts" ON public.appointments FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = appointments.shop_id AND s.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.staff st WHERE st.shop_id = appointments.shop_id AND st.user_id = auth.uid())
);
DROP POLICY IF EXISTS "users update own appts" ON public.appointments;
CREATE POLICY "users update own appts" ON public.appointments FOR UPDATE TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = appointments.shop_id AND s.owner_id = auth.uid())
) WITH CHECK (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = appointments.shop_id AND s.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "users delete own appts" ON public.appointments;
CREATE POLICY "users delete own appts" ON public.appointments FOR DELETE TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = appointments.shop_id AND s.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "anyone view shop working hours" ON public.shop_working_hours;
CREATE POLICY "anyone view shop working hours" ON public.shop_working_hours FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin or owner manage shop working hours" ON public.shop_working_hours;
CREATE POLICY "admin or owner manage shop working hours" ON public.shop_working_hours FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = shop_working_hours.shop_id AND s.owner_id = auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = shop_working_hours.shop_id AND s.owner_id = auth.uid()));

DROP POLICY IF EXISTS "admin or owner manage virtual pos charges" ON public.virtual_pos_charges;
CREATE POLICY "admin or owner manage virtual pos charges" ON public.virtual_pos_charges FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = virtual_pos_charges.shop_id AND s.owner_id = auth.uid()))
WITH CHECK (created_by = auth.uid() AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = virtual_pos_charges.shop_id AND s.owner_id = auth.uid())));

-- Storage: public read + authenticated uploads to own folder (avatars/covers/logo/splash included).
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;
DROP POLICY IF EXISTS "Public read barbershop photos" ON storage.objects;
CREATE POLICY "Public read barbershop photos" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'barbershop-photos');
DROP POLICY IF EXISTS "Owners staff or admin upload barbershop photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload own barbershop photos" ON storage.objects;
CREATE POLICY "Authenticated users upload own barbershop photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'barbershop-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Owners admins update barbershop photos" ON storage.objects;
CREATE POLICY "Owners admins update barbershop photos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'barbershop-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.owner_id = auth.uid())))
WITH CHECK (bucket_id = 'barbershop-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.owner_id = auth.uid())));
DROP POLICY IF EXISTS "Owners admins delete barbershop photos" ON storage.objects;
CREATE POLICY "Owners admins delete barbershop photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'barbershop-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.owner_id = auth.uid())));
