
CREATE POLICY "public read shop photos" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'barbershop-photos');
CREATE POLICY "auth users upload shop photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'barbershop-photos');
CREATE POLICY "auth users update shop photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'barbershop-photos');
CREATE POLICY "auth users delete shop photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'barbershop-photos');
