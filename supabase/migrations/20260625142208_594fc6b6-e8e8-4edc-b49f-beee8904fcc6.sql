
-- Add new shop categories
ALTER TYPE public.shop_category ADD VALUE IF NOT EXISTS 'spa_massage';
ALTER TYPE public.shop_category ADD VALUE IF NOT EXISTS 'yoga_pilates';
ALTER TYPE public.shop_category ADD VALUE IF NOT EXISTS 'slimming';

-- App settings (welcome text)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read_all" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "settings_admin_write" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.app_settings (key, value) VALUES
  ('welcome_title', 'Bugün nasıl şıklaşıyoruz?'),
  ('welcome_subtitle', 'Hoş geldin')
ON CONFLICT (key) DO NOTHING;

-- Announcements (popup)
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ann_read_all" ON public.announcements FOR SELECT TO anon, authenticated
  USING (active = true AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY "ann_admin_all" ON public.announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- User activity log
CREATE TABLE IF NOT EXISTS public.user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  ip text,
  city text,
  region text,
  country text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.user_activity TO authenticated;
GRANT ALL ON public.user_activity TO service_role;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "act_self_insert" ON public.user_activity FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "act_admin_read" ON public.user_activity FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR auth.uid() = user_id);

-- Add last_seen_at, last_ip, last_city to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_ip text,
  ADD COLUMN IF NOT EXISTS last_city text,
  ADD COLUMN IF NOT EXISTS last_country text;
