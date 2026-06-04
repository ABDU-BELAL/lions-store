CREATE OR REPLACE FUNCTION public.process_purchase(p_user_id uuid, p_product_id uuid, p_game_user_id text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_price numeric;
  v_title text;
  v_balance numeric;
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

  SELECT balance INTO v_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (p_user_id, 0);
    v_balance := 0;
  END IF;

  IF v_balance < v_price THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.wallets
  SET balance = balance - v_price, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.orders (user_id, product_id, product_title, amount, game_user_id, status)
  VALUES (p_user_id, p_product_id, v_title, v_price, p_game_user_id, 'pending')
  RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.purchase_product(uuid, text) FROM PUBLIC, anon, authenticated;