
-- ============ Wallet ledger ============
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit','purchase','refund','adjustment')),
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  description text,
  ref_table text,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own ledger"
  ON public.wallet_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all ledger"
  ON public.wallet_transactions FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX wallet_transactions_user_created_idx
  ON public.wallet_transactions (user_id, created_at DESC);

-- ============ Rate limit log ============
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- Only service_role uses this table; no policies for clients.

CREATE INDEX rate_limits_key_created_idx
  ON public.rate_limits (key, created_at DESC);

-- ============ Update process_purchase to write ledger ============
CREATE OR REPLACE FUNCTION public.process_purchase(
  p_user_id uuid,
  p_product_id uuid,
  p_game_user_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_price numeric;
  v_title text;
  v_balance numeric;
  v_new_balance numeric;
  v_order_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT price, title INTO v_price, v_title
  FROM public.products
  WHERE id = p_product_id AND is_active = true;

  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Product not available';
  END IF;

  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance IS NULL THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (p_user_id, 0);
    v_balance := 0;
  END IF;

  IF v_balance < v_price THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  v_new_balance := v_balance - v_price;

  UPDATE public.wallets SET balance = v_new_balance, updated_at = now() WHERE user_id = p_user_id;

  INSERT INTO public.orders (user_id, product_id, product_title, amount, game_user_id, status)
  VALUES (p_user_id, p_product_id, v_title, v_price, p_game_user_id, 'pending')
  RETURNING id INTO v_order_id;

  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description, ref_table, ref_id)
  VALUES (p_user_id, 'purchase', -v_price, v_new_balance, v_title, 'orders', v_order_id);

  RETURN v_order_id;
END;
$function$;
