
-- Featured flag for shops
ALTER TABLE public.barbershops ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- Guest booking fields
ALTER TABLE public.appointments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS guest_name text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS guest_phone text;

-- Replace cancellation trigger to enforce >=24h for cancels
CREATE OR REPLACE FUNCTION public.validate_appointment_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.starts_at < (date_trunc('day', now()) + INTERVAL '1 day') THEN
      RAISE EXCEPTION 'Randevu en erken yarın için alınabilir.';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    IF OLD.starts_at < now() + INTERVAL '24 hours' THEN
      RAISE EXCEPTION 'Randevu sadece 24 saatten önce iptal edilebilir.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_validate ON public.appointments;
DROP TRIGGER IF EXISTS appointments_validate_time ON public.appointments;
CREATE TRIGGER appointments_validate
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_changes();

-- Allow guest inserts (no auth) into appointments
DROP POLICY IF EXISTS "Anyone can create appointments" ON public.appointments;
CREATE POLICY "Anyone can create appointments"
  ON public.appointments FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (user_id IS NULL AND guest_name IS NOT NULL AND guest_phone IS NOT NULL)
  );

GRANT INSERT ON public.appointments TO anon;

-- In-app notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System inserts notifications" ON public.notifications FOR INSERT TO authenticated, anon WITH CHECK (true);

-- After appointment confirmation, notify customer, owner, staff, and admins
CREATE OR REPLACE FUNCTION public.notify_appointment_confirmed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_shop_name text;
  v_owner uuid;
  v_staff_user uuid;
  v_admin record;
  v_when text;
BEGIN
  IF NEW.status <> 'confirmed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' THEN RETURN NEW; END IF;

  SELECT name, owner_id INTO v_shop_name, v_owner FROM public.barbershops WHERE id = NEW.shop_id;
  v_when := to_char(NEW.starts_at AT TIME ZONE 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI');

  -- Customer
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, body, appointment_id)
    VALUES (NEW.user_id, 'Randevun onaylandı', v_shop_name || ' · ' || v_when, NEW.id);
  END IF;

  -- Owner
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, body, appointment_id)
    VALUES (v_owner, 'Yeni randevu', v_shop_name || ' · ' || v_when, NEW.id);
  END IF;

  -- Staff (if assigned and linked to a user)
  IF NEW.staff_id IS NOT NULL THEN
    SELECT user_id INTO v_staff_user FROM public.staff WHERE id = NEW.staff_id;
    IF v_staff_user IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, title, body, appointment_id)
      VALUES (v_staff_user, 'Sana randevu atandı', v_shop_name || ' · ' || v_when, NEW.id);
    END IF;
  END IF;

  -- Admins
  FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications(user_id, title, body, appointment_id)
    VALUES (v_admin.user_id, 'Yeni randevu (admin)', v_shop_name || ' · ' || v_when, NEW.id);
  END LOOP;

  RETURN NEW;
END;
$$;

-- staff.user_id link for notifications
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS appointments_notify ON public.appointments;
CREATE TRIGGER appointments_notify
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_appointment_confirmed();
