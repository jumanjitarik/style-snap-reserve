
-- 1) discount_codes: remove public read
DROP POLICY IF EXISTS "Public can read codes" ON public.discount_codes;

-- 2) barbershop-photos storage: drop overly permissive INSERT policies, add scoped one
DROP POLICY IF EXISTS "Auth upload barbershop photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload barbershop-photos" ON storage.objects;
DROP POLICY IF EXISTS "auth users upload shop photos" ON storage.objects;

CREATE POLICY "Owners staff or admin upload barbershop photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'barbershop-photos'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff st WHERE st.user_id = auth.uid())
  )
);

-- 3) Revoke EXECUTE on trigger-only SECURITY DEFINER functions from authenticated/anon/public
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_appointment_confirmed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_cancel_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_appointment_reminders() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_discount_usage() FROM PUBLIC, anon, authenticated;
