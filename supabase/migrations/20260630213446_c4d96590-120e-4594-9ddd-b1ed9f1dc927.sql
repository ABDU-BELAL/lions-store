ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refunded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reason text;

CREATE INDEX IF NOT EXISTS idx_orders_provider_pending
  ON public.orders (provider, status)
  WHERE status = 'pending';