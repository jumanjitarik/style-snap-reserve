CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

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

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "only admins insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "only admins update roles" ON public.user_roles;
DROP POLICY IF EXISTS "only admins delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin or owner manage shops" ON public.barbershops;
DROP POLICY IF EXISTS "admin or owner manage services" ON public.services;
DROP POLICY IF EXISTS "admin or owner manage staff" ON public.staff;
DROP POLICY IF EXISTS "users see own appts" ON public.appointments;
DROP POLICY IF EXISTS "users update own appts" ON public.appointments;
DROP POLICY IF EXISTS "users delete own appts" ON public.appointments;

CREATE POLICY "admins manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin or owner manage shops"
ON public.barbershops
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR (auth.uid() = owner_id))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR (auth.uid() = owner_id));

CREATE POLICY "admin or owner manage services"
ON public.services
FOR ALL
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = services.shop_id AND s.owner_id = auth.uid())
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = services.shop_id AND s.owner_id = auth.uid())
);

CREATE POLICY "admin or owner manage staff"
ON public.staff
FOR ALL
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = staff.shop_id AND s.owner_id = auth.uid())
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = staff.shop_id AND s.owner_id = auth.uid())
);

CREATE POLICY "users see own appts"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id)
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = appointments.shop_id AND s.owner_id = auth.uid())
);

CREATE POLICY "users update own appts"
ON public.appointments
FOR UPDATE
TO authenticated
USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "users delete own appts"
ON public.appointments
FOR DELETE
TO authenticated
USING (
  (auth.uid() = user_id)
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = appointments.shop_id AND s.owner_id = auth.uid())
);