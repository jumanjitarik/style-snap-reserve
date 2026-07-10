DROP POLICY IF EXISTS settings_read_admin_all ON public.app_settings;
CREATE POLICY settings_read_admin_all ON public.app_settings FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS settings_read_public ON public.app_settings;
CREATE POLICY settings_read_public ON public.app_settings FOR SELECT TO anon, authenticated USING (
  (key <> ALL (ARRAY['paytr_merchant_id'::text, 'paytr_merchant_key'::text, 'paytr_merchant_salt'::text]))
  AND (key !~~ 'paytr_%'::text)
  AND (key !~~ '%_secret'::text)
  AND (key !~~ '%_key'::text)
  AND (key !~~ '%_token'::text)
);