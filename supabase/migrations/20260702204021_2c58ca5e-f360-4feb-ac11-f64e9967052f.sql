
CREATE TABLE public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  ip TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.login_attempts (email, created_at DESC);
CREATE INDEX ON public.login_attempts (ip, created_at DESC);
GRANT ALL ON public.login_attempts TO service_role;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read login attempts" ON public.login_attempts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.security_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_type TEXT NOT NULL CHECK (block_type IN ('ip','email','user')),
  value TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  unblocked_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX security_blocks_active_uniq ON public.security_blocks (block_type, value) WHERE unblocked_at IS NULL;
GRANT SELECT ON public.security_blocks TO authenticated;
GRANT ALL ON public.security_blocks TO service_role;
ALTER TABLE public.security_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read security_blocks" ON public.security_blocks FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
