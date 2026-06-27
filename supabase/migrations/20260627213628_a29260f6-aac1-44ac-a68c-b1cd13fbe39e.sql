
CREATE POLICY "customers notify shop owners on booking"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.barbershops s WHERE s.owner_id = notifications.user_id
  )
);
