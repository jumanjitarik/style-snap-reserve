REVOKE EXECUTE ON FUNCTION public.enforce_cancel_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_appointment_confirmed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_discount_usage() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_appointment_reminders() FROM PUBLIC, anon, authenticated;