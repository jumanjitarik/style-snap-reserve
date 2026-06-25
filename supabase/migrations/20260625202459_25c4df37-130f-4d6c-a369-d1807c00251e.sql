-- Ensure anyone (anon + authenticated) can read files in barbershop-photos bucket
DROP POLICY IF EXISTS "Public read barbershop-photos" ON storage.objects;
CREATE POLICY "Public read barbershop-photos"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'barbershop-photos');

DROP POLICY IF EXISTS "Authenticated upload barbershop-photos" ON storage.objects;
CREATE POLICY "Authenticated upload barbershop-photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'barbershop-photos');

DROP POLICY IF EXISTS "Authenticated update barbershop-photos" ON storage.objects;
CREATE POLICY "Authenticated update barbershop-photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'barbershop-photos');

DROP POLICY IF EXISTS "Authenticated delete barbershop-photos" ON storage.objects;
CREATE POLICY "Authenticated delete barbershop-photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'barbershop-photos');