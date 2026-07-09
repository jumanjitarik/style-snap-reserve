
-- Fix: barbershop photos - remove overly broad EXISTS check
DROP POLICY IF EXISTS "Owners admins update barbershop photos" ON storage.objects;
DROP POLICY IF EXISTS "Owners admins delete barbershop photos" ON storage.objects;

CREATE POLICY "Owners admins update barbershop photos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'barbershop-photos' AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.barbershops b
      WHERE b.owner_id = auth.uid()
        AND (storage.foldername(name))[1] = b.id::text
    )
  )
) WITH CHECK (
  bucket_id = 'barbershop-photos' AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.barbershops b
      WHERE b.owner_id = auth.uid()
        AND (storage.foldername(name))[1] = b.id::text
    )
  )
);

CREATE POLICY "Owners admins delete barbershop photos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'barbershop-photos' AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.barbershops b
      WHERE b.owner_id = auth.uid()
        AND (storage.foldername(name))[1] = b.id::text
    )
  )
);

-- Fix: business-docs - remove public read
DROP POLICY IF EXISTS "Public read business docs" ON storage.objects;

-- Fix: business-docs - restrict uploads to authenticated users scoped to own folder
DROP POLICY IF EXISTS "Anyone upload business docs" ON storage.objects;

CREATE POLICY "Authenticated upload own business docs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'business-docs'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Fix: app_settings - restrict access to secret keys
DROP POLICY IF EXISTS "settings_read_all" ON public.app_settings;

CREATE POLICY "settings_read_public" ON public.app_settings
FOR SELECT USING (
  key NOT IN ('paytr_merchant_id','paytr_merchant_key','paytr_merchant_salt')
  AND key NOT LIKE 'paytr_%'
  AND key NOT LIKE '%_secret'
  AND key NOT LIKE '%_key'
  AND key NOT LIKE '%_token'
);

CREATE POLICY "settings_read_admin_all" ON public.app_settings
FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));
