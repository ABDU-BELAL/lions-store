
-- ===== partner_api.sql (partner / reseller API) =====
-- 1) Add the `partner` value to the role enum (safe to re-run).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'partner'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'partner';
  END IF;
END $$;

-- 2) API keys (hashed with sha256 — plaintext is never stored).
CREATE TABLE IF NOT EXISTS public.partner_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key text NOT NULL UNIQUE,
  label text,
  active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_api_keys_user_idx ON public.partner_api_keys(user_id);

GRANT ALL ON public.partner_api_keys TO service_role;
ALTER TABLE public.partner_api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_api_keys service role only" ON public.partner_api_keys;
CREATE POLICY "partner_api_keys service role only"
  ON public.partner_api_keys FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3) Idempotency map: one order_uid per partner.
CREATE TABLE IF NOT EXISTS public.partner_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_uid text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, order_uid)
);
CREATE INDEX IF NOT EXISTS partner_orders_order_idx ON public.partner_orders(order_id);

GRANT ALL ON public.partner_orders TO service_role;
ALTER TABLE public.partner_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_orders service role only" ON public.partner_orders;
CREATE POLICY "partner_orders service role only"
  ON public.partner_orders FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 4) updated_at triggers (function comes from the base schema).
DROP TRIGGER IF EXISTS update_partner_api_keys_updated_at ON public.partner_api_keys;
CREATE TRIGGER update_partner_api_keys_updated_at
  BEFORE UPDATE ON public.partner_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_partner_orders_updated_at ON public.partner_orders;
CREATE TRIGGER update_partner_orders_updated_at
  BEFORE UPDATE ON public.partner_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
