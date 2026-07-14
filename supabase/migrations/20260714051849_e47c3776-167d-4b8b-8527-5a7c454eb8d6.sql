
CREATE TABLE public.custom_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon_url text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT ON public.custom_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_categories TO authenticated;
GRANT ALL ON public.custom_categories TO service_role;
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_public_read" ON public.custom_categories FOR SELECT USING (true);
CREATE POLICY "cat_admin_all" ON public.custom_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER trg_custom_categories_updated
  BEFORE UPDATE ON public.custom_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.barbershop_categories (
  shop_id uuid not null references public.barbershops(id) on delete cascade,
  category_id uuid not null references public.custom_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shop_id, category_id)
);
CREATE INDEX barbershop_categories_cat_idx ON public.barbershop_categories(category_id);
CREATE INDEX barbershop_categories_shop_idx ON public.barbershop_categories(shop_id);
GRANT SELECT ON public.barbershop_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbershop_categories TO authenticated;
GRANT ALL ON public.barbershop_categories TO service_role;
ALTER TABLE public.barbershop_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sc_public_read" ON public.barbershop_categories FOR SELECT USING (true);
CREATE POLICY "sc_admin_all" ON public.barbershop_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

INSERT INTO public.custom_categories (slug, name, sort_order) VALUES
  ('male_barber','Erkek Kuaförü',1),
  ('female_barber','Kadın Kuaförü',2),
  ('laser','Lazer Epilasyon',3),
  ('nail','Tırnak Bakımı',4),
  ('skin_aesthetic','Cilt Bakımı & Estetik',5),
  ('fitness','Fitness Salonu',6),
  ('spa_massage','Spa & Masaj',7),
  ('yoga_pilates','Yoga & Pilates',8),
  ('slimming','İncelme',9)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.barbershop_categories (shop_id, category_id)
SELECT b.id, c.id
FROM public.barbershops b
JOIN public.custom_categories c ON c.slug = (CASE
  WHEN b.category::text IN ('skin','aesthetic') THEN 'skin_aesthetic'
  ELSE b.category::text END)
ON CONFLICT DO NOTHING;
