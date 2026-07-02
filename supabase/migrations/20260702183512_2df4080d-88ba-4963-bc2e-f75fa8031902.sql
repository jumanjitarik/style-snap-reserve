
CREATE TABLE public.memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  shop_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_ids UUID[] NOT NULL DEFAULT '{}',
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_ref TEXT,
  guest_name TEXT,
  guest_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own memberships" ON public.memberships FOR SELECT
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = memberships.shop_id AND s.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.staff st WHERE st.shop_id = memberships.shop_id AND st.user_id = auth.uid())
);

CREATE POLICY "users create own memberships" ON public.memberships FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "privileged manage memberships" ON public.memberships FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = memberships.shop_id AND s.owner_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = memberships.shop_id AND s.owner_id = auth.uid())
);

CREATE POLICY "privileged delete memberships" ON public.memberships FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = memberships.shop_id AND s.owner_id = auth.uid())
);

CREATE TRIGGER memberships_set_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX memberships_shop_created_idx ON public.memberships(shop_id, created_at DESC);
CREATE INDEX memberships_user_created_idx ON public.memberships(user_id, created_at DESC);
