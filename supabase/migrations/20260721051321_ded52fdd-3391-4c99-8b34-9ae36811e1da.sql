
DO $$
DECLARE
  cats text[] := ARRAY[
    'male_barber','female_barber','laser','nail','skin','aesthetic',
    'spa_massage','yoga_pilates','slimming','fitness',
    'estetik','dis_bakimi','diyet'
  ];
  cat_label jsonb := '{
    "male_barber":"Erkek Kuaförü",
    "female_barber":"Kadın Kuaförü",
    "laser":"Lazer",
    "nail":"Tırnak",
    "skin":"Cilt Bakımı",
    "aesthetic":"Estetik & Cilt",
    "spa_massage":"Spa & Masaj",
    "yoga_pilates":"Yoga & Pilates",
    "slimming":"İncelme",
    "fitness":"Fitness",
    "estetik":"Estetik",
    "dis_bakimi":"Diş Bakımı",
    "diyet":"Diyetisyen"
  }';
  c text;
  cur int;
  need int;
  i int;
  lat numeric;
  lng numeric;
  new_id uuid;
  label text;
BEGIN
  FOREACH c IN ARRAY cats LOOP
    EXECUTE format('SELECT count(*) FROM public.barbershops WHERE category = %L::public.shop_category', c) INTO cur;
    need := 10 - cur;
    label := cat_label->>c;
    IF need > 0 THEN
      FOR i IN 1..need LOOP
        lat := 36.5444 + (random() - 0.5) * 0.05;
        lng := 31.9964 + (random() - 0.5) * 0.05;
        EXECUTE format(
          'INSERT INTO public.barbershops(name, category, address, city, phone, lat, lng, description, is_featured, allow_full_payment, allow_deposit_payment) VALUES (%L, %L::public.shop_category, %L, %L, %L, %s, %s, %L, false, true, true) RETURNING id',
          label || ' Alanya #' || (cur + i),
          c,
          'Alanya Merkez, Antalya',
          'Antalya',
          '+90 555 ' || lpad((100 + (random()*899)::int)::text, 3, '0') || ' ' || lpad(((random()*9999)::int)::text, 4, '0'),
          lat::text,
          lng::text,
          label || ' hizmeti veren demo salon.'
        ) INTO new_id;

        INSERT INTO public.services(shop_id, name, price, duration_min)
        VALUES
          (new_id, label || ' - Standart', 150 + (random()*200)::int, 30),
          (new_id, label || ' - Premium',  300 + (random()*400)::int, 60),
          (new_id, label || ' - Özel Paket', 600 + (random()*600)::int, 90);
      END LOOP;
    END IF;
  END LOOP;
END $$;
