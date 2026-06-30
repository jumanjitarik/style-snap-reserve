-- Remove direct Data API execution of security-definer helpers while keeping them usable inside RLS.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_customer_basics(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_basics(uuid[]) TO authenticated;