  BEFORE UPDATE ON public.partner_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 5) Revealable partner keys (run this in the SQL Editor) =====
ALTER TABLE public.partner_api_keys ADD COLUMN IF NOT EXISTS api_key_hash text;
ALTER TABLE public.partner_api_keys ADD COLUMN IF NOT EXISTS key_prefix text;
ALTER TABLE public.partner_api_keys ADD COLUMN IF NOT EXISTS note text;
-- plaintext token, readable ONLY through the service role (RLS: service_role only)
ALTER TABLE public.partner_api_keys ADD COLUMN IF NOT EXISTS api_key_secret text;
ALTER TABLE public.partner_api_keys ALTER COLUMN api_key DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS partner_api_keys_hash_uidx
  ON public.partner_api_keys(api_key_hash) WHERE api_key_hash IS NOT NULL;
