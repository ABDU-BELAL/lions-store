
CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_type text,
  p_description text,
  p_ref_table text,
  p_ref_id uuid
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_new numeric;
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL THEN
    RAISE EXCEPTION 'Invalid arguments';
  END IF;

  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance IS NULL THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    v_balance := 0;
  END IF;

  v_new := v_balance + p_amount;
  UPDATE public.wallets SET balance = v_new, updated_at = now() WHERE user_id = p_user_id;

  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description, ref_table, ref_id)
  VALUES (p_user_id, p_type, p_amount, v_new, p_description, p_ref_table, p_ref_id);

  RETURN v_new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric, text, text, text, uuid) TO service_role;

-- Explicit deny-all policy on rate_limits so the linter sees access control
-- (table is only written by server functions using service_role, which bypasses RLS).
DROP POLICY IF EXISTS "Deny all client access" ON public.rate_limits;
CREATE POLICY "Deny all client access" ON public.rate_limits
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
