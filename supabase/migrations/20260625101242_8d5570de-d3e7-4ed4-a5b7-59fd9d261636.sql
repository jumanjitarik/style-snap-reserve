
DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
REVOKE EXECUTE ON FUNCTION public.notify_appointment_confirmed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_appointment_changes() FROM PUBLIC, anon, authenticated;
