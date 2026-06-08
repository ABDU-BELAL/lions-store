REVOKE EXECUTE ON FUNCTION public.purchase_product(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text, numeric) FROM authenticated;