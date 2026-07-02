
DROP POLICY IF EXISTS "Anyone can submit request" ON public.business_requests;
CREATE POLICY "Anyone can submit request" ON public.business_requests FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(trim(business_name)) BETWEEN 1 AND 200
    AND length(trim(address)) BETWEEN 1 AND 500
    AND length(trim(services)) BETWEEN 1 AND 1000
    AND length(trim(subject)) BETWEEN 1 AND 2000
    AND length(trim(phone)) BETWEEN 5 AND 30
  );
