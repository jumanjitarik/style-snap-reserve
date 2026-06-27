
CREATE POLICY "owners view customers with appointments" ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a
    JOIN public.barbershops s ON s.id = a.shop_id
    WHERE a.user_id = profiles.id AND s.owner_id = auth.uid()
  )
);
