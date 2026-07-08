
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed';

ALTER TABLE public.virtual_pos_charges
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS membership_id  uuid REFERENCES public.memberships(id)  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.restrict_appointment_user_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_is_priv boolean;
BEGIN
  -- System / background (service role) updates bypass restrictions.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

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
$function$;
