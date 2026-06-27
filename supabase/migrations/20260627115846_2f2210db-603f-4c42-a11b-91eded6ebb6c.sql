
CREATE TABLE IF NOT EXISTS public.translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL UNIQUE,
  tr text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.translations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.translations TO authenticated;
GRANT ALL ON public.translations TO service_role;

ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "translations_read_all" ON public.translations FOR SELECT USING (true);
CREATE POLICY "translations_admin_insert" ON public.translations FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "translations_admin_update" ON public.translations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "translations_admin_delete" ON public.translations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_translations_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_translations_updated_at BEFORE UPDATE ON public.translations
FOR EACH ROW EXECUTE FUNCTION public.set_translations_updated_at();

INSERT INTO public.translations (source, tr) VALUES
  ('Page not found', 'Sayfa bulunamadı'),
  ('Go home', 'Ana sayfaya dön'),
  ('Try again', 'Tekrar dene'),
  ('This page didn''t load', 'Bu sayfa yüklenemedi'),
  ('Something went wrong on our end. You can try refreshing or head back home.', 'Bir sorun oluştu. Yenilemeyi deneyin veya ana sayfaya dönün.'),
  ('The page you''re looking for doesn''t exist or has been moved.', 'Aradığınız sayfa bulunmuyor veya taşınmış.')
ON CONFLICT (source) DO NOTHING;
