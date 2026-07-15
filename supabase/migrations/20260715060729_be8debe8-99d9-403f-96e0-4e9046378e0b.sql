CREATE OR REPLACE FUNCTION public.sync_barbershop_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_cat_id uuid;
  v_old_cat_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.category IS DISTINCT FROM NEW.category AND OLD.category IS NOT NULL THEN
    SELECT id INTO v_old_cat_id FROM public.custom_categories WHERE slug = OLD.category::text;
    IF v_old_cat_id IS NOT NULL THEN
      DELETE FROM public.barbershop_categories
        WHERE shop_id = NEW.id AND category_id = v_old_cat_id;
    END IF;
  END IF;

  IF NEW.category IS NOT NULL THEN
    SELECT id INTO v_new_cat_id FROM public.custom_categories WHERE slug = NEW.category::text;
    IF v_new_cat_id IS NOT NULL THEN
      INSERT INTO public.barbershop_categories(shop_id, category_id)
        VALUES (NEW.id, v_new_cat_id)
        ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_barbershop_category ON public.barbershops;
CREATE TRIGGER trg_sync_barbershop_category
AFTER INSERT OR UPDATE OF category ON public.barbershops
FOR EACH ROW EXECUTE FUNCTION public.sync_barbershop_category();

-- Back-fill any shops missing their primary-category join row
INSERT INTO public.barbershop_categories(shop_id, category_id)
SELECT b.id, c.id
FROM public.barbershops b
JOIN public.custom_categories c ON c.slug = b.category::text
ON CONFLICT DO NOTHING;