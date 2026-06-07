
-- Revoke execute from public/anon/authenticated on privileged SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purchase_product(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_product(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- has_role / is_admin are needed by RLS policies; keep authenticated execute
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
