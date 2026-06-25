
-- Products: provider mapping
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_product_id text,
  ADD COLUMN IF NOT EXISTS auto_fulfill_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_provider_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_provider_check
  CHECK (provider IS NULL OR provider IN ('brand1'));

-- Orders: provider tracking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_order_id text,
  ADD COLUMN IF NOT EXISTS provider_uuid uuid,
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS provider_reply jsonb,
  ADD COLUMN IF NOT EXISTS provider_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_attempts int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS orders_provider_pending_idx
  ON public.orders (provider_started_at)
  WHERE provider IS NOT NULL AND status = 'pending';

CREATE INDEX IF NOT EXISTS orders_provider_uuid_idx
  ON public.orders (provider_uuid)
  WHERE provider_uuid IS NOT NULL;
