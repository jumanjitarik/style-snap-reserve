
-- A4: Çalışan çakışma koruma trigger
CREATE OR REPLACE FUNCTION public.prevent_staff_overlap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.staff_id IS NOT NULL AND NEW.status <> 'cancelled' THEN
    IF EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.staff_id = NEW.staff_id
        AND a.status <> 'cancelled'
        AND a.id IS DISTINCT FROM NEW.id
        AND a.starts_at = NEW.starts_at
    ) THEN
      RAISE EXCEPTION 'Bu çalışan için seçilen saatte zaten bir randevu var.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_staff_overlap ON public.appointments;
CREATE TRIGGER trg_prevent_staff_overlap
  BEFORE INSERT OR UPDATE OF staff_id, starts_at, status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_staff_overlap();

-- A2: Yorumları yazar bilgisiyle döndüren güvenli RPC (isim gizliliği: "Ad S.")
CREATE OR REPLACE FUNCTION public.get_shop_reviews(_shop_id uuid)
RETURNS TABLE(id uuid, rating integer, comment text, created_at timestamptz, user_id uuid, author_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    r.id, r.rating, r.comment, r.created_at, r.user_id,
    COALESCE(
      NULLIF(
        trim(
          split_part(coalesce(p.full_name,''), ' ', 1) ||
          CASE
            WHEN coalesce(split_part(p.full_name,' ',2),'') <> ''
              THEN ' ' || left(split_part(p.full_name,' ',2),1) || '.'
            ELSE ''
          END
        ),
        ''
      ),
      'Kullanıcı'
    ) AS author_name
  FROM public.reviews r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.shop_id = _shop_id
  ORDER BY r.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_shop_reviews(uuid) TO anon, authenticated;

-- B1: 24 saat önce hatırlatma için sütun + fonksiyon güncellemesi
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminded_24h boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.process_appointment_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record; v_when text; v_shop text; v_owner uuid; v_staff_user uuid;
BEGIN
  -- 24 saat kala müşteriye hatırlatma
  FOR r IN SELECT a.* FROM public.appointments a
           WHERE a.status = 'confirmed' AND a.reminded_24h = false
             AND a.starts_at BETWEEN now() + INTERVAL '23 hours 55 minutes'
                                 AND now() + INTERVAL '24 hours 10 minutes'
  LOOP
    SELECT name INTO v_shop FROM public.barbershops WHERE id = r.shop_id;
    v_when := to_char(r.starts_at AT TIME ZONE 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI');
    IF r.user_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, title, body, appointment_id)
      VALUES (r.user_id, 'Yarın randevun var', v_shop || ' · ' || v_when, r.id);
    END IF;
    UPDATE public.appointments SET reminded_24h = true WHERE id = r.id;
  END LOOP;

  -- 2 saat kala (mevcut)
  FOR r IN SELECT a.* FROM public.appointments a
           WHERE a.status = 'confirmed' AND a.reminded_2h = false
             AND a.starts_at BETWEEN now() + INTERVAL '115 minutes' AND now() + INTERVAL '125 minutes'
  LOOP
    SELECT name, owner_id INTO v_shop, v_owner FROM public.barbershops WHERE id = r.shop_id;
    v_when := to_char(r.starts_at AT TIME ZONE 'Europe/Istanbul', 'HH24:MI');
    IF r.user_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, title, body, appointment_id)
      VALUES (r.user_id, 'Randevuna 2 saat kaldı', v_shop || ' · ' || v_when, r.id);
    END IF;
    IF v_owner IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, title, body, appointment_id)
      VALUES (v_owner, 'Randevuya 2 saat kaldı', v_shop || ' · ' || v_when, r.id);
    END IF;
    IF r.staff_id IS NOT NULL THEN
      SELECT user_id INTO v_staff_user FROM public.staff WHERE id = r.staff_id;
      IF v_staff_user IS NOT NULL THEN
        INSERT INTO public.notifications(user_id, title, body, appointment_id)
        VALUES (v_staff_user, 'Randevuya 2 saat kaldı', v_shop || ' · ' || v_when, r.id);
      END IF;
    END IF;
    UPDATE public.appointments SET reminded_2h = true WHERE id = r.id;
  END LOOP;

  -- 1 saat kala (mevcut)
  FOR r IN SELECT a.* FROM public.appointments a
           WHERE a.status = 'confirmed' AND a.reminded_1h = false
             AND a.starts_at BETWEEN now() + INTERVAL '55 minutes' AND now() + INTERVAL '65 minutes'
  LOOP
    SELECT name, owner_id INTO v_shop, v_owner FROM public.barbershops WHERE id = r.shop_id;
    v_when := to_char(r.starts_at AT TIME ZONE 'Europe/Istanbul', 'HH24:MI');
    IF r.user_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, title, body, appointment_id)
      VALUES (r.user_id, 'Randevuna 1 saat kaldı', v_shop || ' · ' || v_when, r.id);
    END IF;
    IF v_owner IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, title, body, appointment_id)
      VALUES (v_owner, 'Randevuya 1 saat kaldı', v_shop || ' · ' || v_when, r.id);
    END IF;
    IF r.staff_id IS NOT NULL THEN
      SELECT user_id INTO v_staff_user FROM public.staff WHERE id = r.staff_id;
      IF v_staff_user IS NOT NULL THEN
        INSERT INTO public.notifications(user_id, title, body, appointment_id)
        VALUES (v_staff_user, 'Randevuya 1 saat kaldı', v_shop || ' · ' || v_when, r.id);
      END IF;
    END IF;
    UPDATE public.appointments SET reminded_1h = true WHERE id = r.id;
  END LOOP;
END;
$$;

-- B3: Bekleme listesi (boş slot bildirimi)
CREATE TABLE IF NOT EXISTS public.appointment_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  watch_date date NOT NULL,
  slot_time time,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS appointment_watchers_uniq
  ON public.appointment_watchers (user_id, shop_id, watch_date, COALESCE(slot_time, '00:00:00'::time));

GRANT SELECT, INSERT, DELETE ON public.appointment_watchers TO authenticated;
GRANT ALL ON public.appointment_watchers TO service_role;

ALTER TABLE public.appointment_watchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS watchers_own_select ON public.appointment_watchers;
DROP POLICY IF EXISTS watchers_own_insert ON public.appointment_watchers;
DROP POLICY IF EXISTS watchers_own_delete ON public.appointment_watchers;

CREATE POLICY watchers_own_select ON public.appointment_watchers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY watchers_own_insert ON public.appointment_watchers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY watchers_own_delete ON public.appointment_watchers
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Randevu iptal edildiğinde eşleşen izleyicilere bildirim gönder
CREATE OR REPLACE FUNCTION public.notify_appointment_watchers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shop_name text;
  v_date date;
  v_time time;
  v_when text;
  w record;
BEGIN
  IF NEW.status <> 'cancelled' OR OLD.status = 'cancelled' THEN RETURN NEW; END IF;
  SELECT name INTO v_shop_name FROM public.barbershops WHERE id = NEW.shop_id;
  v_date := (NEW.starts_at AT TIME ZONE 'Europe/Istanbul')::date;
  v_time := (NEW.starts_at AT TIME ZONE 'Europe/Istanbul')::time;
  v_when := to_char(NEW.starts_at AT TIME ZONE 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI');

  FOR w IN
    SELECT * FROM public.appointment_watchers
    WHERE shop_id = NEW.shop_id
      AND watch_date = v_date
      AND (slot_time IS NULL OR slot_time = v_time)
      AND notified_at IS NULL
  LOOP
    INSERT INTO public.notifications(user_id, title, body)
    VALUES (w.user_id, 'Boş randevu çıktı!', COALESCE(v_shop_name, 'Salon') || ' · ' || v_when || ' saatinde yer açıldı.');
    UPDATE public.appointment_watchers SET notified_at = now() WHERE id = w.id;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_appointment_watchers ON public.appointments;
CREATE TRIGGER trg_notify_appointment_watchers
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_appointment_watchers();
