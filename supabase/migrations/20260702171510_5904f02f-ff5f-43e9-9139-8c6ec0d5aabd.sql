
-- business_requests
CREATE TABLE public.business_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  address text NOT NULL,
  services text NOT NULL,
  subject text NOT NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_requests TO authenticated;
GRANT INSERT ON public.business_requests TO anon;
GRANT ALL ON public.business_requests TO service_role;
ALTER TABLE public.business_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit request" ON public.business_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins manage requests" ON public.business_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_business_requests_updated BEFORE UPDATE ON public.business_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- slot_overrides
CREATE TABLE public.slot_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  date date NOT NULL,
  slot_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, date, slot_time)
);
GRANT SELECT ON public.slot_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.slot_overrides TO authenticated;
GRANT ALL ON public.slot_overrides TO service_role;
ALTER TABLE public.slot_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view slot overrides" ON public.slot_overrides FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners/admins manage own slot overrides" ON public.slot_overrides FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.id = slot_overrides.shop_id AND b.owner_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.id = slot_overrides.shop_id AND b.owner_id = auth.uid())
  );
CREATE TRIGGER trg_slot_overrides_updated BEFORE UPDATE ON public.slot_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
