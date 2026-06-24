
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_id varchar(8),
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_custom_id_unique ON public.profiles(custom_id);

ALTER TABLE public.topup_requests
  ADD COLUMN IF NOT EXISTS screenshot_path text;

CREATE OR REPLACE FUNCTION public.gen_custom_id()
RETURNS varchar
LANGUAGE plpgsql
AS $$
DECLARE
  v_id varchar(8);
  v_attempts int := 0;
BEGIN
  LOOP
    v_id := lpad((floor(random() * 90000000) + 10000000)::text, 8, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE custom_id = v_id);
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN RAISE EXCEPTION 'Could not generate unique custom_id'; END IF;
  END LOOP;
  RETURN v_id;
END;
$$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE custom_id IS NULL LOOP
    UPDATE public.profiles SET custom_id = public.gen_custom_id() WHERE id = r.id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.is_banned(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_banned FROM public.profiles WHERE id = _user_id), false)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email, custom_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.email,
    public.gen_custom_id()
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT (user_id, role) DO NOTHING;

  IF LOWER(NEW.email) = 'omomar.yasso1@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_purchase(p_user_id uuid, p_product_id uuid, p_game_user_id text DEFAULT NULL::text, p_quantity numeric DEFAULT NULL::numeric)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_price numeric; v_title text; v_qty_enabled boolean; v_unit_size numeric;
  v_min numeric; v_max numeric; v_qty numeric; v_total numeric;
  v_balance numeric; v_new_balance numeric; v_order_id uuid; v_discount numeric;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.is_banned(p_user_id) THEN RAISE EXCEPTION 'تم تعليق حسابك. تواصل مع الدعم.'; END IF;

  SELECT price, title, quantity_enabled, unit_size, min_quantity, max_quantity
    INTO v_price, v_title, v_qty_enabled, v_unit_size, v_min, v_max
  FROM public.products WHERE id = p_product_id AND is_active = true;
  IF v_price IS NULL THEN RAISE EXCEPTION 'Product not available'; END IF;

  IF v_qty_enabled THEN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    IF v_min IS NOT NULL AND p_quantity < v_min THEN RAISE EXCEPTION 'Quantity below minimum'; END IF;
    IF v_max IS NOT NULL AND p_quantity > v_max THEN RAISE EXCEPTION 'Quantity above maximum'; END IF;
    v_qty := p_quantity;
    v_total := ROUND((p_quantity / v_unit_size) * v_price, 2);
  ELSE
    v_qty := NULL; v_total := v_price;
  END IF;

  SELECT COALESCE(MAX(percent), 0) INTO v_discount
  FROM public.user_discounts WHERE user_id = p_user_id AND product_id = p_product_id;
  IF v_discount > 0 THEN v_total := ROUND(v_total * (1 - v_discount / 100.0), 2); END IF;

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

DROP POLICY IF EXISTS "Users create own topups" ON public.topup_requests;
CREATE POLICY "Users create own topups" ON public.topup_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND NOT public.is_banned(auth.uid()) AND amount >= 100);
