
-- 1. Server-side payment/discount/points recomputation on appointment INSERT
CREATE OR REPLACE FUNCTION public.compute_appointment_amounts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total numeric := 0;
  v_discount numeric := 0;
  v_code public.discount_codes%ROWTYPE;
  v_user_points int := 0;
  v_points_used int := COALESCE(NEW.points_used, 0);
  v_after numeric;
  v_final numeric;
BEGIN
  IF NEW.service_ids IS NOT NULL AND array_length(NEW.service_ids, 1) > 0 THEN
    SELECT COALESCE(SUM(price), 0) INTO v_total FROM public.services WHERE id = ANY(NEW.service_ids);
  ELSE
    SELECT COALESCE(price, 0) INTO v_total FROM public.services WHERE id = NEW.service_id;
  END IF;

  IF NEW.discount_code IS NOT NULL AND NEW.discount_code <> '' THEN
    SELECT * INTO v_code FROM public.discount_codes
      WHERE code = NEW.discount_code AND active = true
        AND (expires_at IS NULL OR expires_at > now());
    IF FOUND THEN
      v_discount := CASE WHEN v_code.discount_type = 'percent'
        THEN v_total * v_code.discount_value / 100
        ELSE v_code.discount_value END;
      v_discount := LEAST(v_discount, v_total);
    ELSE
      v_discount := 0;
      NEW.discount_code := NULL;
    END IF;
  END IF;

  v_after := GREATEST(0, v_total - v_discount);

  IF NEW.user_id IS NOT NULL AND v_points_used > 0 THEN
    SELECT COALESCE(points, 0) INTO v_user_points FROM public.profiles WHERE id = NEW.user_id;
    v_points_used := LEAST(v_points_used, v_user_points, FLOOR(v_after)::int);
  ELSE
    v_points_used := 0;
  END IF;

  v_final := GREATEST(0, v_after - v_points_used);

  NEW.discount_amount := v_discount;
  NEW.points_used := v_points_used;

  IF NEW.payment_method = 'deposit' THEN
    NEW.deposit_amount := ROUND(v_final * 0.25);
    NEW.remaining_amount := GREATEST(0, v_final - NEW.deposit_amount);
    NEW.payment_amount := NEW.deposit_amount;
  ELSE
    NEW.deposit_amount := v_final;
    NEW.remaining_amount := 0;
    NEW.payment_amount := v_final;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_appointment_amounts ON public.appointments;
CREATE TRIGGER trg_compute_appointment_amounts
BEFORE INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.compute_appointment_amounts();

-- 2. Restrict appointment UPDATEs by customers to only status=cancelled and notes
CREATE OR REPLACE FUNCTION public.restrict_appointment_user_updates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_is_priv boolean;
BEGIN
  SELECT (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = NEW.shop_id AND s.owner_id = auth.uid())
  ) INTO v_is_priv;
  IF v_is_priv THEN RETURN NEW; END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.shop_id IS DISTINCT FROM OLD.shop_id
     OR NEW.staff_id IS DISTINCT FROM OLD.staff_id
     OR NEW.service_id IS DISTINCT FROM OLD.service_id
     OR NEW.service_ids IS DISTINCT FROM OLD.service_ids
     OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
     OR NEW.payment_amount IS DISTINCT FROM OLD.payment_amount
     OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
     OR NEW.discount_code IS DISTINCT FROM OLD.discount_code
     OR NEW.deposit_amount IS DISTINCT FROM OLD.deposit_amount
     OR NEW.remaining_amount IS DISTINCT FROM OLD.remaining_amount
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.points_earned IS DISTINCT FROM OLD.points_earned
     OR NEW.points_used IS DISTINCT FROM OLD.points_used
     OR NEW.payment_ref IS DISTINCT FROM OLD.payment_ref
     OR NEW.reminded_1h IS DISTINCT FROM OLD.reminded_1h
     OR NEW.reminded_2h IS DISTINCT FROM OLD.reminded_2h
     OR NEW.guest_name IS DISTINCT FROM OLD.guest_name
     OR NEW.guest_phone IS DISTINCT FROM OLD.guest_phone
  THEN
    RAISE EXCEPTION 'Bu alanı değiştirme yetkiniz yok.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Sadece iptal yapabilirsiniz.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_appointment_user_updates ON public.appointments;
CREATE TRIGGER trg_restrict_appointment_user_updates
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.restrict_appointment_user_updates();

-- 3. Cancel-limit no longer deletes auth user; only counts self-cancels and soft-blocks
CREATE OR REPLACE FUNCTION public.enforce_cancel_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') AND NEW.user_id IS NOT NULL THEN
    IF auth.uid() IS DISTINCT FROM NEW.user_id THEN
      RETURN NEW;
    END IF;
    SELECT count(*) INTO v_count FROM public.appointments
      WHERE user_id = NEW.user_id AND status = 'cancelled'
        AND created_at >= date_trunc('day', now());
    IF v_count >= 3 THEN
      UPDATE public.profiles SET is_blocked = true WHERE id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. has_role: switch to SECURITY INVOKER, simplify user_roles SELECT policy to avoid recursion
DROP POLICY IF EXISTS "users see own roles" ON public.user_roles;
CREATE POLICY "users see own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 5. Tighten notifications INSERT policy: only customers with an appointment at that owner's shop
DROP POLICY IF EXISTS "customers notify shop owners on booking" ON public.notifications;
CREATE POLICY "customers notify shop owners on booking" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.barbershops s ON s.id = a.shop_id
      WHERE a.user_id = auth.uid() AND s.owner_id = notifications.user_id
    )
  );
