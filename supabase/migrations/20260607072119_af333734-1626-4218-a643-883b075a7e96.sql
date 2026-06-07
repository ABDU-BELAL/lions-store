
-- Restrict site_settings reads to admins only (accessed server-side via admin client)
DROP POLICY IF EXISTS "Public can read site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_public_read" ON public.site_settings;
DROP POLICY IF EXISTS "Public read site_settings" ON public.site_settings;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='site_settings' AND cmd='SELECT' LOOP
    EXECUTE format('DROP POLICY %I ON public.site_settings', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Admins can read site settings"
  ON public.site_settings FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Revoke EXECUTE on SECURITY DEFINER functions from anon (only authenticated callers need them via RLS)
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.purchase_product(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purchase_product(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text) TO service_role;
