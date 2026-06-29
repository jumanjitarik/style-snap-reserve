
-- Drop overly permissive owner SELECT policy on profiles that exposed tracking columns
DROP POLICY IF EXISTS "owners view customers with appointments" ON public.profiles;

-- Provide a security-definer RPC for shop owners/admins to fetch only safe customer columns
CREATE OR REPLACE FUNCTION public.get_customer_basics(_ids uuid[])
RETURNS TABLE (id uuid, full_name text, phone text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.phone, p.email
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.appointments a
        JOIN public.barbershops s ON s.id = a.shop_id
        WHERE a.user_id = p.id AND s.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.appointments a
        JOIN public.staff st ON st.id = a.staff_id
        WHERE a.user_id = p.id AND st.user_id = auth.uid()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_customer_basics(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_basics(uuid[]) TO authenticated;
