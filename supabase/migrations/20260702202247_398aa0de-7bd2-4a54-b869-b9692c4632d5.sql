
INSERT INTO public.app_settings(key, value) VALUES ('welcome_points', '0')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_welcome int := 0;
  v_setting text;
BEGIN
  SELECT value INTO v_setting FROM public.app_settings WHERE key = 'welcome_points';
  BEGIN
    v_welcome := GREATEST(0, COALESCE(NULLIF(v_setting, '')::int, 0));
  EXCEPTION WHEN OTHERS THEN
    v_welcome := 0;
  END;

  INSERT INTO public.profiles (id, full_name, email, phone, gender, points)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    (NEW.raw_user_meta_data->>'gender')::public.gender,
    v_welcome
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'customer'));
  RETURN NEW;
END;
$function$;
