
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS in_stock boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.process_purchase(p_user_id uuid, p_product_id uuid, p_game_user_id text DEFAULT NULL::text, p_quantity numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_price numeric; v_title text; v_qty_enabled boolean; v_unit_size numeric;
  v_min numeric; v_max numeric; v_qty numeric; v_total numeric;
  v_balance numeric; v_new_balance numeric; v_order_id uuid;
  v_user_discount numeric; v_vip_level int; v_vip_discount numeric; v_effective numeric;
  v_in_stock boolean;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.is_banned(p_user_id) THEN RAISE EXCEPTION 'تم تعليق حسابك. تواصل مع الدعم.'; END IF;

  SELECT price, title, quantity_enabled, unit_size, min_quantity, max_quantity, in_stock
    INTO v_price, v_title, v_qty_enabled, v_unit_size, v_min, v_max, v_in_stock
  FROM public.products WHERE id = p_product_id AND is_active = true;
  IF v_price IS NULL THEN RAISE EXCEPTION 'Product not available'; END IF;
  IF v_in_stock IS NOT TRUE THEN RAISE EXCEPTION 'المنتج غير متوفر حاليًا (نفد المخزون)'; END IF;

  IF v_qty_enabled THEN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    IF v_min IS NOT NULL AND p_quantity < v_min THEN RAISE EXCEPTION 'Quantity below minimum'; END IF;
    IF v_max IS NOT NULL AND p_quantity > v_max THEN RAISE EXCEPTION 'Quantity above maximum'; END IF;
    v_qty := p_quantity;
    v_total := ROUND((p_quantity / v_unit_size) * v_price, 2);
  ELSE
    v_qty := NULL; v_total := v_price;
  END IF;

  SELECT COALESCE(MAX(percent), 0) INTO v_user_discount
    FROM public.user_discounts
    WHERE user_id = p_user_id AND product_id = p_product_id;

  SELECT vip_level INTO v_vip_level FROM public.profiles WHERE id = p_user_id;
  v_vip_level := COALESCE(v_vip_level, 0);
  v_vip_discount := 0;
  IF v_vip_level > 0 THEN
    SELECT discount_percent INTO v_vip_discount FROM public.vip_tiers WHERE level = v_vip_level;
    v_vip_discount := COALESCE(v_vip_discount, 0);
  END IF;

  v_effective := GREATEST(v_user_discount, v_vip_discount);
  IF v_effective > 0 THEN
    v_total := ROUND(v_total * (1 - v_effective / 100.0), 2);
  END IF;

  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance IS NULL THEN INSERT INTO public.wallets (user_id, balance) VALUES (p_user_id, 0); v_balance := 0; END IF;
  IF v_balance < v_total THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

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
