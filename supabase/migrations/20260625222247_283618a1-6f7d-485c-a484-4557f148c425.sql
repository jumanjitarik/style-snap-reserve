
-- Make sure update trigger helper exists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.discount_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent','amount')),
  discount_value NUMERIC NOT NULL CHECK (discount_value >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.discount_codes TO anon, authenticated;
GRANT ALL ON public.discount_codes TO service_role;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read codes" ON public.discount_codes FOR SELECT USING (true);
CREATE POLICY "Admins manage codes" ON public.discount_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_discount_codes_updated BEFORE UPDATE ON public.discount_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS discount_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reminded_2h BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminded_1h BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.process_appointment_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record; v_when text; v_shop text; v_owner uuid; v_staff_user uuid;
BEGIN
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

CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'appointment-reminders') THEN
    PERFORM cron.schedule('appointment-reminders', '*/5 * * * *',
      $cron$ SELECT public.process_appointment_reminders(); $cron$);
  END IF;
END $$;
