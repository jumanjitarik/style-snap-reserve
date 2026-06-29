
DROP POLICY IF EXISTS "public read shop photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read barbershop photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read barbershop-photos" ON storage.objects;

CREATE POLICY "Owner or admin read barbershop photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'barbershop-photos'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );
