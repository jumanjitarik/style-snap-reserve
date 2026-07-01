
ALTER TABLE public.barbershops
  ADD COLUMN IF NOT EXISTS allow_full_payment boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_deposit_payment boolean NOT NULL DEFAULT true;

INSERT INTO public.app_settings (key, value) VALUES ('deposit_percent', '25')
ON CONFLICT (key) DO NOTHING;
