
DROP POLICY IF EXISTS "Admins read business docs" ON storage.objects;
CREATE POLICY "Admins read business docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'business-docs' AND public.has_role(auth.uid(), 'admin'::public.app_role));
