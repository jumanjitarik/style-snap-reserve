
CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  settled_at timestamptz NOT NULL DEFAULT now(),
  iban text,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated;
GRANT ALL ON public.settlements TO service_role;

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access settlements"
  ON public.settlements FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Owners can view own shop settlements"
  ON public.settlements FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));

CREATE TRIGGER settlements_updated_at
  BEFORE UPDATE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX settlements_shop_settled_idx ON public.settlements(shop_id, settled_at DESC);
