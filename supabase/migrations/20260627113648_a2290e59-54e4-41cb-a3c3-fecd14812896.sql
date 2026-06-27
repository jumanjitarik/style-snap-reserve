
-- 1) Storage: scope DELETE/UPDATE to uploader (first path segment = auth.uid()) or admin
DROP POLICY IF EXISTS "Auth delete barbershop photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth update barbershop photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete barbershop-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update barbershop-photos" ON storage.objects;
DROP POLICY IF EXISTS "auth users delete shop photos" ON storage.objects;
DROP POLICY IF EXISTS "auth users update shop photos" ON storage.objects;

CREATE POLICY "Owner or admin delete barbershop photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'barbershop-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Owner or admin update barbershop photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'barbershop-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
)
WITH CHECK (
  bucket_id = 'barbershop-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- 2) Appointments: add DELETE policy (own, shop owner, admin)
DROP POLICY IF EXISTS "users delete own appts" ON public.appointments;
CREATE POLICY "users delete own appts"
ON public.appointments FOR DELETE TO authenticated
USING (
  (auth.uid() = user_id)
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = appointments.shop_id AND s.owner_id = auth.uid())
);

-- 3) user_roles: restrictive policy makes intent explicit; only admins write
CREATE POLICY "only admins write roles"
ON public.user_roles AS RESTRICTIVE
FOR ALL TO authenticated, anon
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) admin_broadcast: revoke from public/anon; function self-checks admin role
REVOKE ALL ON FUNCTION public.admin_broadcast(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_broadcast(text, text, text, text, text) TO authenticated;
