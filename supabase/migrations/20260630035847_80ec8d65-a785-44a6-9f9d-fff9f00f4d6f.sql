
-- Allow public read access to barbershop photos (covers, logos, splash, gallery)
-- The bucket cannot be made public (workspace policy), so signed URLs are used,
-- but signed-url creation still requires a SELECT policy match.
DROP POLICY IF EXISTS "Owner or admin read barbershop photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read barbershop photos" ON storage.objects;
CREATE POLICY "Public read barbershop photos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'barbershop-photos');

-- Let salon owners and admins manage gallery / cover / branding paths
-- (paths like shop-cover/*, shop-gallery/*, branding/* don't start with a uid).
DROP POLICY IF EXISTS "Owner or admin update barbershop photos" ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin delete barbershop photos" ON storage.objects;
CREATE POLICY "Owners admins update barbershop photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'barbershop-photos' AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.owner_id = auth.uid())
  )
);
CREATE POLICY "Owners admins delete barbershop photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'barbershop-photos' AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.owner_id = auth.uid())
  )
);
