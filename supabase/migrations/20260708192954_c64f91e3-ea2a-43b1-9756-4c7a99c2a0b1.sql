
ALTER TABLE public.business_requests ADD COLUMN IF NOT EXISTS tax_certificate_url text;

-- Allow anyone (anon + authenticated) to upload to business-docs bucket
DROP POLICY IF EXISTS "Anyone upload business docs" ON storage.objects;
CREATE POLICY "Anyone upload business docs" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'business-docs');

DROP POLICY IF EXISTS "Public read business docs" ON storage.objects;
CREATE POLICY "Public read business docs" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'business-docs');
