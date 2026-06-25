
REVOKE EXECUTE ON FUNCTION public.admin_broadcast(text, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_broadcast(text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_broadcast(text, text, text, text, text) TO authenticated;
