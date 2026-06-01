
-- Auto-grant super_admin to specific email on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.email
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Bootstrap owner account
  IF LOWER(NEW.email) = 'omomar.yasso1@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atomic purchase RPC: debits wallet and creates order, returns the new order id
CREATE OR REPLACE FUNCTION public.purchase_product(p_product_id uuid, p_game_user_id text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_price numeric;
  v_title text;
  v_balance numeric;
  v_order_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT price, title INTO v_price, v_title
  FROM public.products
  WHERE id = p_product_id AND is_active = true;

  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Product not available';
  END IF;

  -- Lock wallet row
  SELECT balance INTO v_balance
  FROM public.wallets
  WHERE user_id = v_user
  FOR UPDATE;

  IF v_balance IS NULL THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (v_user, 0);
    v_balance := 0;
  END IF;

  IF v_balance < v_price THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.wallets
  SET balance = balance - v_price, updated_at = now()
  WHERE user_id = v_user;

  INSERT INTO public.orders (user_id, product_id, product_title, amount, game_user_id, status)
  VALUES (v_user, p_product_id, v_title, v_price, p_game_user_id, 'pending')
  RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_product(uuid, text) TO authenticated;
