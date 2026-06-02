
-- Lock down user_roles: block all client writes; only SECURITY DEFINER funcs (running as postgres) can modify
CREATE POLICY "No client inserts on user_roles"
ON public.user_roles FOR INSERT TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "No client updates on user_roles"
ON public.user_roles FOR UPDATE TO authenticated, anon
USING (false);

CREATE POLICY "No client deletes on user_roles"
ON public.user_roles FOR DELETE TO authenticated, anon
USING (false);

-- Allow users to delete their own profile
CREATE POLICY "Users delete own profile"
ON public.profiles FOR DELETE TO authenticated
USING (auth.uid() = id);

-- Allow admins to view all profiles (for admin dashboard)
CREATE POLICY "Admins view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- Revoke public EXECUTE on SECURITY DEFINER functions; only service_role (admin server) and authenticated (purchase_product via RLS-bound auth.uid()) need access
REVOKE EXECUTE ON FUNCTION public.purchase_product(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.purchase_product(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;
