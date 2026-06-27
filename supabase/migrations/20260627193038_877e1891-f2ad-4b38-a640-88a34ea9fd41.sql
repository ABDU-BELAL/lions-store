
-- 1) Cron secret stored in DB; admin-only RLS, but service_role reads it.
INSERT INTO public.site_settings(key, value)
VALUES ('cron_secret', jsonb_build_object('value', encode(gen_random_bytes(32), 'hex')))
ON CONFLICT (key) DO NOTHING;

-- 2) Revoke EXECUTE from anon/public on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.get_effective_discount(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_assign_vip(uuid, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_vip(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_vip_tier(integer, text, text, numeric, numeric, text, text, text, numeric) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_vip_columns() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_order_vip() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purchase_product(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text, numeric) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric, text, text, text, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gen_custom_id() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_banned(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;

-- 3) Allow authenticated users to delete/update their own topup receipt uploads
CREATE POLICY "Users delete own topup receipts"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'topup-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own topup receipts"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'topup-receipts' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'topup-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
