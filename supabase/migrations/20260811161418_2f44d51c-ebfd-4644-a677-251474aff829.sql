ALTER TABLE public.products ALTER COLUMN price TYPE numeric(18,6);
ALTER TABLE public.products ALTER COLUMN price_usd TYPE numeric(18,6);
ALTER TABLE public.wallets ALTER COLUMN balance TYPE numeric(18,6);
ALTER TABLE public.orders ALTER COLUMN amount TYPE numeric(18,6);
ALTER TABLE public.wallet_transactions ALTER COLUMN amount TYPE numeric(18,6);
ALTER TABLE public.wallet_transactions ALTER COLUMN balance_after TYPE numeric(18,6);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_provider_check;
ALTER TABLE public.products ADD CONSTRAINT products_provider_check
  CHECK (provider IS NULL OR provider IN ('brand1','x3','yassen','sama','wisam','alshaikh'));