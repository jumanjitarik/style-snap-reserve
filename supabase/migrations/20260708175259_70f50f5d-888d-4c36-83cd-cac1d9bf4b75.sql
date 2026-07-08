-- 1) page_seo
CREATE TABLE IF NOT EXISTS public.page_seo (
  path text PRIMARY KEY,
  title text,
  description text,
  keywords text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.page_seo TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_seo TO authenticated;
GRANT ALL ON public.page_seo TO service_role;
ALTER TABLE public.page_seo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo readable to all" ON public.page_seo FOR SELECT USING (true);
CREATE POLICY "seo admins manage" ON public.page_seo FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.set_page_seo_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_page_seo_updated_at ON public.page_seo;
CREATE TRIGGER trg_page_seo_updated_at BEFORE UPDATE ON public.page_seo
  FOR EACH ROW EXECUTE FUNCTION public.set_page_seo_updated_at();

INSERT INTO public.page_seo(path, title, description, keywords) VALUES
  ('/', '', '', ''),
  ('/kuaforler', '', '', ''),
  ('/randevu-al', '', '', ''),
  ('/hesap', '', '', ''),
  ('/isyeri-ekle', '', '', ''),
  ('/borsa', '', '', '')
ON CONFLICT (path) DO NOTHING;

-- 2) virtual_pos_charges – PayTR alanları
ALTER TABLE public.virtual_pos_charges
  ADD COLUMN IF NOT EXISTS payment_channel text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS paytr_merchant_oid text,
  ADD COLUMN IF NOT EXISTS paytr_url text,
  ADD COLUMN IF NOT EXISTS paytr_token text,
  ADD COLUMN IF NOT EXISTS paytr_raw jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS virtual_pos_charges_paytr_oid_key
  ON public.virtual_pos_charges (paytr_merchant_oid) WHERE paytr_merchant_oid IS NOT NULL;

ALTER TABLE public.virtual_pos_charges DROP CONSTRAINT IF EXISTS virtual_pos_charges_status_check;
ALTER TABLE public.virtual_pos_charges
  ADD CONSTRAINT virtual_pos_charges_status_check
  CHECK (status = ANY (ARRAY['paid','pending','failed','cancelled','refunded']));

-- 3) PayTR ayarlarını app_settings'e boş olarak ekle
INSERT INTO public.app_settings(key, value) VALUES
  ('paytr_merchant_id',   ''),
  ('paytr_merchant_key',  ''),
  ('paytr_merchant_salt', ''),
  ('paytr_test_mode',     '1'),
  ('paytr_currency',      'TL')
ON CONFLICT (key) DO NOTHING;