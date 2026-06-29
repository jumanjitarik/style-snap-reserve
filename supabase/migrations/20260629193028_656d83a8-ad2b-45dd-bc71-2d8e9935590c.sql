CREATE TABLE IF NOT EXISTS public.content_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_text text NOT NULL,
  source_lang text NOT NULL DEFAULT 'tr',
  target_lang text NOT NULL,
  translation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_lang, target_lang, source_text)
);

GRANT SELECT ON public.content_translations TO anon, authenticated;
GRANT ALL ON public.content_translations TO service_role;

ALTER TABLE public.content_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Translations readable by everyone"
  ON public.content_translations FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_content_translations_lookup
  ON public.content_translations(source_lang, target_lang, md5(source_text));