-- Revealable partner API keys
ALTER TABLE public.partner_api_keys ADD COLUMN IF NOT EXISTS api_key_hash text;
ALTER TABLE public.partner_api_keys ADD COLUMN IF NOT EXISTS key_prefix text;
ALTER TABLE public.partner_api_keys ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.partner_api_keys ADD COLUMN IF NOT EXISTS api_key_secret text;
ALTER TABLE public.partner_api_keys ALTER COLUMN api_key DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS partner_api_keys_hash_uidx
  ON public.partner_api_keys(api_key_hash) WHERE api_key_hash IS NOT NULL;
