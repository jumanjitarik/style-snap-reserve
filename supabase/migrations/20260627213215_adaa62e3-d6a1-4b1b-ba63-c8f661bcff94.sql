
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS deposit_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'full';

CREATE INDEX IF NOT EXISTS appointments_shop_starts_idx ON public.appointments(shop_id, starts_at DESC);
