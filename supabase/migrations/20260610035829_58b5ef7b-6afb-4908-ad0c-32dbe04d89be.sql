
CREATE TABLE public.user_discounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  percent numeric(5,2) NOT NULL CHECK (percent > 0 AND percent <= 100),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_discounts TO authenticated;
GRANT ALL ON public.user_discounts TO service_role;

ALTER TABLE public.user_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage discounts"
ON public.user_discounts FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can read their own discounts"
ON public.user_discounts FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER user_discounts_touch_updated_at
BEFORE UPDATE ON public.user_discounts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_user_discounts_user ON public.user_discounts(user_id);
CREATE INDEX idx_user_discounts_product ON public.user_discounts(product_id);

-- Patch process_purchase (quantity variant) to apply highest discount
CREATE OR REPLACE FUNCTION public.process_purchase(p_user_id uuid, p_product_id uuid, p_game_user_id text DEFAULT NULL::text, p_quantity numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_price numeric;
  v_title text;
  v_qty_enabled boolean;
  v_unit_size numeric;
  v_min numeric;
  v_max numeric;
  v_qty numeric;
  v_total numeric;
  v_balance numeric;
  v_new_balance numeric;
  v_order_id uuid;
  v_discount numeric;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT price, title, quantity_enabled, unit_size, min_quantity, max_quantity
    INTO v_price, v_title, v_qty_enabled, v_unit_size, v_min, v_max
  FROM public.products
  WHERE id = p_product_id AND is_active = true;

  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Product not available';
  END IF;

  IF v_qty_enabled THEN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity';
    END IF;
    IF v_min IS NOT NULL AND p_quantity < v_min THEN
      RAISE EXCEPTION 'Quantity below minimum';
    END IF;
    IF v_max IS NOT NULL AND p_quantity > v_max THEN
      RAISE EXCEPTION 'Quantity above maximum';
    END IF;
    v_qty := p_quantity;
    v_total := ROUND((p_quantity / v_unit_size) * v_price, 2);
  ELSE
    v_qty := NULL;
    v_total := v_price;
  END IF;

  -- Apply per-user discount on this product (highest wins; unique per user+product so just pick it)
  SELECT COALESCE(MAX(percent), 0) INTO v_discount
  FROM public.user_discounts
  WHERE user_id = p_user_id AND product_id = p_product_id;

  IF v_discount > 0 THEN
    v_total := ROUND(v_total * (1 - v_discount / 100.0), 2);
  END IF;

  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance IS NULL THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (p_user_id, 0);
    v_balance := 0;
  END IF;

  IF v_balance < v_total THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  v_new_balance := v_balance - v_total;
  UPDATE public.wallets SET balance = v_new_balance, updated_at = now() WHERE user_id = p_user_id;

  INSERT INTO public.orders (user_id, product_id, product_title, amount, game_user_id, status, quantity)
  VALUES (p_user_id, p_product_id, v_title, v_total, p_game_user_id, 'pending', v_qty)
  RETURNING id INTO v_order_id;

  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description, ref_table, ref_id)
  VALUES (p_user_id, 'purchase', -v_total, v_new_balance, v_title, 'orders', v_order_id);

  RETURN v_order_id;
END;
$function$;

-- Patch process_purchase (non-quantity variant) to apply discount as well
CREATE OR REPLACE FUNCTION public.process_purchase(p_user_id uuid, p_product_id uuid, p_game_user_id text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_price numeric;
  v_title text;
  v_balance numeric;
  v_new_balance numeric;
  v_order_id uuid;
  v_discount numeric;
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

  SELECT COALESCE(MAX(percent), 0) INTO v_discount
  FROM public.user_discounts
  WHERE user_id = p_user_id AND product_id = p_product_id;

  IF v_discount > 0 THEN
    v_price := ROUND(v_price * (1 - v_discount / 100.0), 2);
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
