
-- 1. Remove hardcoded super_admin grant in handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email, custom_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.email,
    public.gen_custom_id()
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. Banners bucket: allow public SELECT (marketing images)
DROP POLICY IF EXISTS "Banners are publicly readable" ON storage.objects;
CREATE POLICY "Banners are publicly readable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'banners');

-- 3. Topup receipts bucket: admins can read & delete
DROP POLICY IF EXISTS "Admins can read topup receipts" ON storage.objects;
CREATE POLICY "Admins can read topup receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'topup-receipts' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete topup receipts" ON storage.objects;
CREATE POLICY "Admins can delete topup receipts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'topup-receipts' AND public.is_admin(auth.uid()));
