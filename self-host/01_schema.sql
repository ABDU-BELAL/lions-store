-- Consolidated schema for self-hosted Supabase (generated from project migrations, in order)
-- Run this in the SQL editor of YOUR Supabase project.

-- ===== 20260601223430_2c975e0a-83e9-4a8c-b35b-f9d44a5387e0.sql =====
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'super_admin', 'user');
CREATE TYPE public.topup_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.payment_method AS ENUM ('vodafone_cash', 'instapay', 'fawry', 'binance');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin'))
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- ============ WALLETS ============
CREATE TABLE public.wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wallet" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all wallets" ON public.wallets FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- ============ TOPUP REQUESTS ============
CREATE TABLE public.topup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method public.payment_method NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  note TEXT,
  status public.topup_status NOT NULL DEFAULT 'pending',
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.topup_requests TO authenticated;
GRANT ALL ON public.topup_requests TO service_role;
ALTER TABLE public.topup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own topups" ON public.topup_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all topups" ON public.topup_requests FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Users create own topups" ON public.topup_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- ============ PRODUCTS (offers, games, apps) ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'games',
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_offer BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone views active products" ON public.products FOR SELECT TO anon, authenticated USING (is_active OR public.is_admin(auth.uid()));

-- ============ ORDERS (wallet purchases) ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_title TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  game_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all orders" ON public.orders FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- ============ TRIGGERS ============
-- Auto-create profile + wallet on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER wallets_touch BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== 20260601223509_1a8b85a4-9b31-4e0e-b68f-3cf8e065ca0a.sql =====
-- Fix search_path on remaining function
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Lock down SECURITY DEFINER functions — only the DB engine needs them (RLS + triggers)
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- ===== 20260601225359_ba851f7a-916c-430e-b49a-56c714796ce5.sql =====

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


-- ===== 20260602004513_4d59b01c-8a7a-4f2d-a2bd-0167e755602f.sql =====

-- Lock down user_roles: block all client writes; only SECURITY DEFINER funcs (running as postgres) can modify
CREATE POLICY "No client inserts on user_roles"
ON public.user_roles FOR INSERT TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "No client updates on user_roles"
ON public.user_roles FOR UPDATE TO authenticated, anon
USING (false);

CREATE POLICY "No client deletes on user_roles"
ON public.user_roles FOR DELETE TO authenticated, anon
USING (false);

-- Allow users to delete their own profile
CREATE POLICY "Users delete own profile"
ON public.profiles FOR DELETE TO authenticated
USING (auth.uid() = id);

-- Allow admins to view all profiles (for admin dashboard)
CREATE POLICY "Admins view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- Revoke public EXECUTE on SECURITY DEFINER functions; only service_role (admin server) and authenticated (purchase_product via RLS-bound auth.uid()) need access
REVOKE EXECUTE ON FUNCTION public.purchase_product(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.purchase_product(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;


-- ===== 20260603000458_8c20fc94-1571-4bca-97a9-8e35b225fd54.sql =====

CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  link_url text,
  title text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.banners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone views active banners" ON public.banners
  FOR SELECT TO anon, authenticated
  USING (is_active OR is_admin(auth.uid()));

CREATE POLICY "Admins manage banners insert" ON public.banners
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins manage banners update" ON public.banners
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins manage banners delete" ON public.banners
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER banners_touch_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ===== 20260603000529_656079be-3480-4130-8156-655337d8d5d7.sql =====

CREATE POLICY "Admins upload banners" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'banners' AND is_admin(auth.uid()));

CREATE POLICY "Admins update banners" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'banners' AND is_admin(auth.uid()));

CREATE POLICY "Admins delete banners" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'banners' AND is_admin(auth.uid()));


-- ===== 20260604000403_c5b7c1f2-c57b-455e-82d9-d0c42c41b514.sql =====
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- ===== 20260604000632_e510ab0c-4b73-4e98-bb70-3e313f86cc3f.sql =====
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

-- ===== 20260604000855_c278d1a5-c7f1-426e-9314-93b62b6f4688.sql =====
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles"
ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- ===== 20260607070831_0258eb35-c5e8-49f5-895b-6719a659ddc7.sql =====
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

-- ===== 20260607071355_238e029b-2c3a-4c3a-b142-4b1b7e95df67.sql =====
-- collections
CREATE TABLE public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  show_on_home boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.collections TO anon, authenticated;
GRANT ALL ON public.collections TO service_role;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views active collections" ON public.collections FOR SELECT TO anon, authenticated USING (is_active OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage collections" ON public.collections FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER collections_touch BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- link products to a collection (nullable so existing rows keep working)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS products_collection_idx ON public.products(collection_id);

-- site settings (single-row-style key/value)
CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads settings" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins write settings" ON public.site_settings FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER site_settings_touch BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.site_settings (key, value) VALUES
  ('home', '{"show_featured": true, "show_offers": true, "show_collections": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ===== 20260607071413_ab2c1cb9-7840-4cf7-8d82-3a936b5ca936.sql =====
CREATE POLICY "Products bucket: anyone reads" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'products');
CREATE POLICY "Products bucket: admins write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'products' AND public.is_admin(auth.uid()));
CREATE POLICY "Products bucket: admins update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'products' AND public.is_admin(auth.uid()));
CREATE POLICY "Products bucket: admins delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'products' AND public.is_admin(auth.uid()));

-- ===== 20260607072119_af333734-1626-4218-a643-883b075a7e96.sql =====

-- Restrict site_settings reads to admins only (accessed server-side via admin client)
DROP POLICY IF EXISTS "Public can read site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_public_read" ON public.site_settings;
DROP POLICY IF EXISTS "Public read site_settings" ON public.site_settings;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='site_settings' AND cmd='SELECT' LOOP
    EXECUTE format('DROP POLICY %I ON public.site_settings', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Admins can read site settings"
  ON public.site_settings FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Revoke EXECUTE on SECURITY DEFINER functions from anon (only authenticated callers need them via RLS)
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.purchase_product(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purchase_product(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text) TO service_role;


-- ===== 20260607081540_beb2ca3a-4f7a-4dfb-aecb-d37d2b07e8d2.sql =====

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


-- ===== 20260607082330_bd8e10b8-1f8a-4d1a-921a-0d483984a80d.sql =====

-- Revoke execute from public/anon/authenticated on privileged SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purchase_product(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_product(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- has_role / is_admin are needed by RLS policies; keep authenticated execute
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;


-- ===== 20260607082828_5260108b-1b05-444a-8f6a-32904b0fe051.sql =====

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


-- ===== 20260607083550_6151f88f-b656-4cc1-8fe7-6c35d6d5319d.sql =====
CREATE UNIQUE INDEX IF NOT EXISTS topup_requests_reference_unique ON public.topup_requests (reference);

-- ===== 20260607090638_35c22dac-9404-46e9-bed4-ff429f6eccbb.sql =====
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_product_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- ===== 20260607094607_ce503d65-4894-4f45-b234-5c60acc8eb42.sql =====

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS quantity_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unit_size numeric(12,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit_label text,
  ADD COLUMN IF NOT EXISTS min_quantity numeric(12,2),
  ADD COLUMN IF NOT EXISTS max_quantity numeric(12,2);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_unit_size_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_unit_size_check CHECK (unit_size > 0);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS quantity numeric(12,2);

CREATE OR REPLACE FUNCTION public.process_purchase(
  p_user_id uuid,
  p_product_id uuid,
  p_game_user_id text DEFAULT NULL::text,
  p_quantity numeric DEFAULT NULL
)
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


-- ===== 20260608100009_a1515e81-3c20-4180-bb16-bd2ce48287f7.sql =====
CREATE INDEX IF NOT EXISTS orders_user_created_idx ON public.orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_created_idx ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS topup_requests_user_created_idx ON public.topup_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS topup_requests_status_created_idx ON public.topup_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS products_active_sort_idx ON public.products (is_active, sort_order, created_at DESC);

-- ===== 20260608230549_7a5181ca-a63f-4084-9931-8164501a1c85.sql =====
create table public.telegram_chats (
  chat_id text primary key,
  title text,
  added_at timestamptz not null default now()
);

grant all on public.telegram_chats to service_role;
grant select on public.telegram_chats to authenticated;

alter table public.telegram_chats enable row level security;

create policy "admins can view telegram chats"
on public.telegram_chats
for select
to authenticated
using (public.is_admin(auth.uid()));

-- ===== 20260608233550_52c5b7e7-547b-4407-bf48-1389ddbbf5d8.sql =====
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purchase_product(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- ===== 20260608233609_2dc4f525-5e4a-4da2-aa73-1d2c3c62c073.sql =====
REVOKE EXECUTE ON FUNCTION public.purchase_product(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text, numeric) FROM authenticated;

-- ===== 20260610035829_58b5ef7b-6afb-4908-ad0c-32dbe04d89be.sql =====

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


-- ===== 20260624153233_9dfc28cf-d6d8-40cb-a24c-e445627163d5.sql =====

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


-- ===== 20260624153245_7896d023-8566-46ba-9b90-705f55e90441.sql =====

CREATE OR REPLACE FUNCTION public.gen_custom_id()
RETURNS varchar
LANGUAGE plpgsql
SET search_path = public
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

REVOKE EXECUTE ON FUNCTION public.gen_custom_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_banned(uuid) FROM PUBLIC, anon;


-- ===== 20260624153304_ed9345ce-70d0-4fc9-a655-208716117ebf.sql =====

DO $$ BEGIN
  CREATE POLICY "Users upload own topup receipts" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'topup-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users read own topup receipts" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'topup-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ===== 20260624162239_9fb8ad01-5208-477b-9233-556a1b1827c9.sql =====
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS title_en text, ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS title_en text, ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS title_en text;
UPDATE public.products SET title_en = title WHERE title_en IS NULL;
UPDATE public.collections SET title_en = title WHERE title_en IS NULL;

-- ===== 20260624165138_d8c1c096-e02c-40e9-8c4a-28dd8d7fb795.sql =====
ALTER TABLE public.collections ADD COLUMN parent_id uuid REFERENCES public.collections(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS collections_parent_id_idx ON public.collections(parent_id);

-- ===== 20260624173506_039c647a-45ac-45c8-aed9-9f8b31d5b2af.sql =====

-- 1. Remove hardcoded super_admin grant in handle_new_user
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
  RETURN NEW;
END;
$$;

-- 2. Banners bucket: allow public SELECT (marketing images)
DROP POLICY IF EXISTS "Banners are publicly readable" ON storage.objects;
CREATE POLICY "Banners are publicly readable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'banners');

-- 3. Topup receipts bucket: admins can read & delete
DROP POLICY IF EXISTS "Admins can read topup receipts" ON storage.objects;
CREATE POLICY "Admins can read topup receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'topup-receipts' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete topup receipts" ON storage.objects;
CREATE POLICY "Admins can delete topup receipts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'topup-receipts' AND public.is_admin(auth.uid()));


-- ===== 20260625140136_3639f000-96ba-404a-a514-9e362db47c69.sql =====

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


-- ===== 20260626005426_9c7f7dea-6a8b-4249-a736-942a4651ccee.sql =====
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS purchase_field_mode text NOT NULL DEFAULT 'game_id'
  CHECK (purchase_field_mode IN ('game_id','subscription','none'));

-- ===== 20260627082735_2defd481-e07d-44e2-b08a-edbc6614681b.sql =====

-- ============================================================
-- 1. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Allow user to mark as read (only update read_at)
CREATE POLICY "Users mark own notifications read" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. VIP TIERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vip_tiers (
  level int PRIMARY KEY CHECK (level BETWEEN 1 AND 20),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  spend_threshold numeric(12,2) NOT NULL DEFAULT 0 CHECK (spend_threshold >= 0),
  color_hex text NOT NULL DEFAULT '#d4af37',
  accent_hex text NOT NULL DEFAULT '#ffd96b',
  badge_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vip_tiers TO authenticated;
GRANT ALL ON public.vip_tiers TO service_role;

ALTER TABLE public.vip_tiers ENABLE ROW LEVEL SECURITY;

-- Read for everyone signed in. NO direct INSERT/UPDATE/DELETE policies — only service_role (via RPCs) can write.
CREATE POLICY "Anyone authenticated reads vip tiers" ON public.vip_tiers
  FOR SELECT TO authenticated USING (true);

-- Seed 20 default tiers (mirroring brand1-card scale: 0% → 9.5% in 0.5% steps)
INSERT INTO public.vip_tiers (level, name_ar, name_en, discount_percent, spend_threshold, color_hex, accent_hex)
VALUES
  (1,  'مبتدئ',    'Novice',       0.00,        0, '#b87333', '#deb887'),
  (2,  'ناشئ',     'Rookie',       0.50,     2500, '#b87333', '#deb887'),
  (3,  'مستكشف',   'Explorer',     1.00,     5000, '#b87333', '#deb887'),
  (4,  'نشط',      'Active',       1.50,    10000, '#b87333', '#deb887'),
  (5,  'متقدم',    'Advanced',     2.00,    20000, '#c0c0c0', '#e8e8e8'),
  (6,  'رائد',     'Pioneer',      2.50,    35000, '#c0c0c0', '#e8e8e8'),
  (7,  'صاعد',     'Rising',       3.00,    55000, '#c0c0c0', '#e8e8e8'),
  (8,  'محترف',    'Pro',          3.50,    80000, '#c0c0c0', '#e8e8e8'),
  (9,  'خبير',     'Expert',       4.00,   115000, '#d4af37', '#ffd96b'),
  (10, 'ماستر',    'Master',       4.50,   160000, '#d4af37', '#ffd96b'),
  (11, 'نخبة',     'Elite',        5.00,   220000, '#d4af37', '#ffd96b'),
  (12, 'مميز',     'Distinguished',5.50,   300000, '#d4af37', '#ffd96b'),
  (13, 'ألماسي',   'Diamond',      6.00,   400000, '#7dd3fc', '#bae6fd'),
  (14, 'بلاتيني',  'Platinum',     6.50,   525000, '#e5e4e2', '#f5f5f5'),
  (15, 'عملاق',    'Titan',        7.00,   675000, '#a78bfa', '#c4b5fd'),
  (16, 'بطل',      'Champion',     7.50,   850000, '#f472b6', '#fbcfe8'),
  (17, 'أسطورة',   'Legend',       8.00,  1050000, '#fb7185', '#fda4af'),
  (18, 'إمبراطور', 'Emperor',      8.50,  1300000, '#facc15', '#fde047'),
  (19, 'ملك',      'King',         9.00,  1600000, '#f59e0b', '#fbbf24'),
  (20, 'إله',      'God-Tier',     9.50,  2000000, '#dc2626', '#fbbf24')
ON CONFLICT (level) DO NOTHING;

-- ============================================================
-- 3. PROFILES: VIP columns
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vip_level int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vip_assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vip_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS lifetime_spend numeric(14,2) NOT NULL DEFAULT 0;

-- ============================================================
-- 4. DEFENSE TRIGGER: block user from changing VIP/spend
-- ============================================================
-- Even though the existing UPDATE policy lets users update their own profile,
-- this BEFORE UPDATE trigger rejects any change to security-critical columns
-- unless the caller is the service role (i.e. running through our RPCs).
CREATE OR REPLACE FUNCTION public.protect_vip_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    IF NEW.vip_level IS DISTINCT FROM OLD.vip_level THEN
      RAISE EXCEPTION 'forbidden: vip_level is read-only';
    END IF;
    IF NEW.vip_assigned_by IS DISTINCT FROM OLD.vip_assigned_by THEN
      RAISE EXCEPTION 'forbidden: vip_assigned_by is read-only';
    END IF;
    IF NEW.vip_assigned_at IS DISTINCT FROM OLD.vip_assigned_at THEN
      RAISE EXCEPTION 'forbidden: vip_assigned_at is read-only';
    END IF;
    IF NEW.lifetime_spend IS DISTINCT FROM OLD.lifetime_spend THEN
      RAISE EXCEPTION 'forbidden: lifetime_spend is read-only';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_vip_columns_trg ON public.profiles;
CREATE TRIGGER protect_vip_columns_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_vip_columns();

-- ============================================================
-- 5. VIP AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vip_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('assign','revoke','auto_promote','tier_updated')),
  old_level int,
  new_level int,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vip_audit_target ON public.vip_audit_log(target_user_id, created_at DESC);

GRANT SELECT ON public.vip_audit_log TO authenticated;
GRANT ALL ON public.vip_audit_log TO service_role;

ALTER TABLE public.vip_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super admins can read the audit log
CREATE POLICY "Super admins view vip audit" ON public.vip_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- ============================================================
-- 6. ORDER COMPLETION TRIGGER: bump lifetime_spend + auto-promote
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_order_vip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_level int;
  v_new_level int;
  v_new_total numeric;
  v_assigned uuid;
  v_tier_name text;
BEGIN
  -- Increment lifetime_spend
  UPDATE public.profiles
    SET lifetime_spend = lifetime_spend + NEW.amount
    WHERE id = NEW.user_id
    RETURNING vip_level, vip_assigned_by, lifetime_spend
      INTO v_old_level, v_assigned, v_new_total;

  -- Skip auto-promotion if admin manually assigned a level
  IF v_assigned IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Find highest tier whose threshold is met
  SELECT level, name_ar INTO v_new_level, v_tier_name
    FROM public.vip_tiers
    WHERE spend_threshold <= v_new_total
    ORDER BY level DESC
    LIMIT 1;

  v_new_level := COALESCE(v_new_level, 0);

  IF v_new_level > COALESCE(v_old_level, 0) THEN
    UPDATE public.profiles SET vip_level = v_new_level WHERE id = NEW.user_id;

    INSERT INTO public.vip_audit_log (actor_id, target_user_id, action, old_level, new_level, meta)
    VALUES (NULL, NEW.user_id, 'auto_promote', v_old_level, v_new_level,
            jsonb_build_object('lifetime_spend', v_new_total, 'order_id', NEW.id));

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.user_id, 'vip_promotion',
      '🎉 ترقية مستوى VIP!',
      'مبروك! ترقّيت إلى مستوى ' || v_tier_name || ' (LV ' || v_new_level || ')',
      jsonb_build_object('new_level', v_new_level, 'old_level', v_old_level)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS handle_order_vip_trg ON public.orders;
CREATE TRIGGER handle_order_vip_trg
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_order_vip();

-- ============================================================
-- 7. UPDATED process_purchase: include VIP discount (MAX wins)
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_purchase(
  p_user_id uuid,
  p_product_id uuid,
  p_game_user_id text DEFAULT NULL,
  p_quantity numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price numeric; v_title text; v_qty_enabled boolean; v_unit_size numeric;
  v_min numeric; v_max numeric; v_qty numeric; v_total numeric;
  v_balance numeric; v_new_balance numeric; v_order_id uuid;
  v_user_discount numeric; v_vip_level int; v_vip_discount numeric; v_effective numeric;
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

  -- Fetch user manual discount for this product
  SELECT COALESCE(MAX(percent), 0) INTO v_user_discount
    FROM public.user_discounts
    WHERE user_id = p_user_id AND product_id = p_product_id;

  -- Fetch VIP tier discount
  SELECT vip_level INTO v_vip_level FROM public.profiles WHERE id = p_user_id;
  v_vip_level := COALESCE(v_vip_level, 0);
  v_vip_discount := 0;
  IF v_vip_level > 0 THEN
    SELECT discount_percent INTO v_vip_discount FROM public.vip_tiers WHERE level = v_vip_level;
    v_vip_discount := COALESCE(v_vip_discount, 0);
  END IF;

  -- MAX wins (no stacking)
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
$$;

-- ============================================================
-- 8. RPCs for VIP admin operations (super_admin only)
-- ============================================================

-- Get effective discount for a user/product (used by client for display)
CREATE OR REPLACE FUNCTION public.get_effective_discount(p_user_id uuid, p_product_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_pct numeric := 0;
  v_vip_pct numeric := 0;
  v_lvl int;
BEGIN
  IF p_user_id IS NULL THEN RETURN 0; END IF;
  SELECT COALESCE(MAX(percent), 0) INTO v_user_pct
    FROM public.user_discounts
    WHERE user_id = p_user_id AND product_id = p_product_id;
  SELECT vip_level INTO v_lvl FROM public.profiles WHERE id = p_user_id;
  IF COALESCE(v_lvl, 0) > 0 THEN
    SELECT COALESCE(discount_percent, 0) INTO v_vip_pct FROM public.vip_tiers WHERE level = v_lvl;
  END IF;
  RETURN GREATEST(COALESCE(v_user_pct, 0), COALESCE(v_vip_pct, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_discount(uuid, uuid) TO authenticated, service_role;

-- Admin: update a VIP tier
CREATE OR REPLACE FUNCTION public.admin_update_vip_tier(
  p_level int,
  p_name_ar text DEFAULT NULL,
  p_name_en text DEFAULT NULL,
  p_discount_percent numeric DEFAULT NULL,
  p_spend_threshold numeric DEFAULT NULL,
  p_color_hex text DEFAULT NULL,
  p_accent_hex text DEFAULT NULL,
  p_badge_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_level < 1 OR p_level > 20 THEN RAISE EXCEPTION 'invalid level'; END IF;
  IF p_discount_percent IS NOT NULL AND (p_discount_percent < 0 OR p_discount_percent > 100) THEN
    RAISE EXCEPTION 'invalid percent';
  END IF;
  IF p_spend_threshold IS NOT NULL AND p_spend_threshold < 0 THEN
    RAISE EXCEPTION 'invalid threshold';
  END IF;

  UPDATE public.vip_tiers SET
    name_ar = COALESCE(NULLIF(TRIM(p_name_ar), ''), name_ar),
    name_en = COALESCE(NULLIF(TRIM(p_name_en), ''), name_en),
    discount_percent = COALESCE(p_discount_percent, discount_percent),
    spend_threshold = COALESCE(p_spend_threshold, spend_threshold),
    color_hex = COALESCE(NULLIF(TRIM(p_color_hex), ''), color_hex),
    accent_hex = COALESCE(NULLIF(TRIM(p_accent_hex), ''), accent_hex),
    badge_url = COALESCE(p_badge_url, badge_url),
    updated_at = now()
  WHERE level = p_level;

  INSERT INTO public.vip_audit_log (actor_id, target_user_id, action, new_level, meta)
  VALUES (auth.uid(), NULL, 'tier_updated', p_level,
          jsonb_build_object('discount_percent', p_discount_percent, 'spend_threshold', p_spend_threshold));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_vip_tier(int, text, text, numeric, numeric, text, text, text) TO authenticated, service_role;

-- Admin: assign VIP to user (manual override)
CREATE OR REPLACE FUNCTION public.admin_assign_vip(p_target uuid, p_level int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old int;
  v_tier_name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_level < 0 OR p_level > 20 THEN RAISE EXCEPTION 'invalid level'; END IF;
  IF p_target IS NULL THEN RAISE EXCEPTION 'invalid target'; END IF;

  SELECT vip_level INTO v_old FROM public.profiles WHERE id = p_target;
  IF v_old IS NULL THEN RAISE EXCEPTION 'user not found'; END IF;

  UPDATE public.profiles
    SET vip_level = p_level,
        vip_assigned_by = auth.uid(),
        vip_assigned_at = now()
    WHERE id = p_target;

  INSERT INTO public.vip_audit_log (actor_id, target_user_id, action, old_level, new_level)
  VALUES (auth.uid(), p_target, 'assign', v_old, p_level);

  IF p_level > 0 AND p_level <> v_old THEN
    SELECT name_ar INTO v_tier_name FROM public.vip_tiers WHERE level = p_level;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (p_target, 'vip_promotion',
            '🎉 تم منحك مستوى VIP!',
            'مبروك! تم منحك مستوى ' || COALESCE(v_tier_name, '') || ' (LV ' || p_level || ') من إدارة الموقع',
            jsonb_build_object('new_level', p_level, 'old_level', v_old, 'manual', true));
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_vip(uuid, int) TO authenticated, service_role;

-- Admin: revoke manual VIP (returns user to auto mode)
CREATE OR REPLACE FUNCTION public.admin_revoke_vip(p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old int;
  v_spend numeric;
  v_new int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_target IS NULL THEN RAISE EXCEPTION 'invalid target'; END IF;

  SELECT vip_level, lifetime_spend INTO v_old, v_spend FROM public.profiles WHERE id = p_target;
  IF v_old IS NULL THEN RAISE EXCEPTION 'user not found'; END IF;

  -- Recompute auto level based on spend
  SELECT COALESCE(MAX(level), 0) INTO v_new FROM public.vip_tiers WHERE spend_threshold <= COALESCE(v_spend, 0);

  UPDATE public.profiles
    SET vip_level = v_new, vip_assigned_by = NULL, vip_assigned_at = NULL
    WHERE id = p_target;

  INSERT INTO public.vip_audit_log (actor_id, target_user_id, action, old_level, new_level)
  VALUES (auth.uid(), p_target, 'revoke', v_old, v_new);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_revoke_vip(uuid) TO authenticated, service_role;


-- ===== 20260627083650_b917d91a-4d3b-4d0d-929a-dee01ca35e56.sql =====

-- Add USD spend threshold column for dual-currency VIP tier display
ALTER TABLE public.vip_tiers ADD COLUMN IF NOT EXISTS usd_spend_threshold numeric NOT NULL DEFAULT 0;

-- Seed temporary USD values mirroring EGP thresholds at an indicative ~50 EGP/USD ratio
-- (admins can edit these from the dashboard)
UPDATE public.vip_tiers SET usd_spend_threshold = ROUND(spend_threshold / 50.0, 2) WHERE usd_spend_threshold = 0;

-- Ensure grants exist (idempotent) so service_role / authenticated can reach the table via PostgREST
GRANT SELECT ON public.vip_tiers TO authenticated;
GRANT ALL ON public.vip_tiers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- Update RPC to accept USD threshold
CREATE OR REPLACE FUNCTION public.admin_update_vip_tier(
  p_level integer,
  p_name_ar text DEFAULT NULL,
  p_name_en text DEFAULT NULL,
  p_discount_percent numeric DEFAULT NULL,
  p_spend_threshold numeric DEFAULT NULL,
  p_color_hex text DEFAULT NULL,
  p_accent_hex text DEFAULT NULL,
  p_badge_url text DEFAULT NULL,
  p_usd_spend_threshold numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_level < 1 OR p_level > 20 THEN RAISE EXCEPTION 'invalid level'; END IF;
  IF p_discount_percent IS NOT NULL AND (p_discount_percent < 0 OR p_discount_percent > 100) THEN
    RAISE EXCEPTION 'invalid percent';
  END IF;
  IF p_spend_threshold IS NOT NULL AND p_spend_threshold < 0 THEN
    RAISE EXCEPTION 'invalid threshold';
  END IF;
  IF p_usd_spend_threshold IS NOT NULL AND p_usd_spend_threshold < 0 THEN
    RAISE EXCEPTION 'invalid usd threshold';
  END IF;

  UPDATE public.vip_tiers SET
    name_ar = COALESCE(NULLIF(TRIM(p_name_ar), ''), name_ar),
    name_en = COALESCE(NULLIF(TRIM(p_name_en), ''), name_en),
    discount_percent = COALESCE(p_discount_percent, discount_percent),
    spend_threshold = COALESCE(p_spend_threshold, spend_threshold),
    usd_spend_threshold = COALESCE(p_usd_spend_threshold, usd_spend_threshold),
    color_hex = COALESCE(NULLIF(TRIM(p_color_hex), ''), color_hex),
    accent_hex = COALESCE(NULLIF(TRIM(p_accent_hex), ''), accent_hex),
    badge_url = COALESCE(p_badge_url, badge_url),
    updated_at = now()
  WHERE level = p_level;

  INSERT INTO public.vip_audit_log (actor_id, target_user_id, action, new_level, meta)
  VALUES (auth.uid(), NULL, 'tier_updated', p_level,
          jsonb_build_object('discount_percent', p_discount_percent, 'spend_threshold', p_spend_threshold, 'usd_spend_threshold', p_usd_spend_threshold));
END;
$function$;


-- ===== 20260627084732_ac96b618-cecd-4af6-b853-99d01583d72d.sql =====
DROP FUNCTION IF EXISTS public.admin_update_vip_tier(integer, text, text, numeric, numeric, text, text, text);

-- ===== 20260627084901_c9459955-733f-40a4-b388-417a31c1bd8f.sql =====

CREATE OR REPLACE FUNCTION public.admin_update_vip_tier(
  p_level integer,
  p_name_ar text DEFAULT NULL,
  p_name_en text DEFAULT NULL,
  p_discount_percent numeric DEFAULT NULL,
  p_spend_threshold numeric DEFAULT NULL,
  p_color_hex text DEFAULT NULL,
  p_accent_hex text DEFAULT NULL,
  p_badge_url text DEFAULT NULL,
  p_usd_spend_threshold numeric DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_level < 1 OR p_level > 20 THEN RAISE EXCEPTION 'invalid level'; END IF;
  IF p_discount_percent IS NOT NULL AND (p_discount_percent < 0 OR p_discount_percent > 100) THEN
    RAISE EXCEPTION 'invalid percent';
  END IF;
  IF p_spend_threshold IS NOT NULL AND p_spend_threshold < 0 THEN RAISE EXCEPTION 'invalid threshold'; END IF;
  IF p_usd_spend_threshold IS NOT NULL AND p_usd_spend_threshold < 0 THEN RAISE EXCEPTION 'invalid usd threshold'; END IF;

  UPDATE public.vip_tiers SET
    name_ar = COALESCE(NULLIF(TRIM(p_name_ar), ''), name_ar),
    name_en = COALESCE(NULLIF(TRIM(p_name_en), ''), name_en),
    discount_percent = COALESCE(p_discount_percent, discount_percent),
    spend_threshold = COALESCE(p_spend_threshold, spend_threshold),
    usd_spend_threshold = COALESCE(p_usd_spend_threshold, usd_spend_threshold),
    color_hex = COALESCE(NULLIF(TRIM(p_color_hex), ''), color_hex),
    accent_hex = COALESCE(NULLIF(TRIM(p_accent_hex), ''), accent_hex),
    badge_url = COALESCE(p_badge_url, badge_url),
    updated_at = now()
  WHERE level = p_level;

  INSERT INTO public.vip_audit_log (actor_id, target_user_id, action, new_level, meta)
  VALUES (auth.uid(), NULL, 'tier_updated', p_level,
          jsonb_build_object('discount_percent', p_discount_percent, 'spend_threshold', p_spend_threshold, 'usd_spend_threshold', p_usd_spend_threshold));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_assign_vip(p_target uuid, p_level integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_old int; v_tier_name text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_level < 0 OR p_level > 20 THEN RAISE EXCEPTION 'invalid level'; END IF;
  IF p_target IS NULL THEN RAISE EXCEPTION 'invalid target'; END IF;
  SELECT vip_level INTO v_old FROM public.profiles WHERE id = p_target;
  IF v_old IS NULL THEN RAISE EXCEPTION 'user not found'; END IF;
  UPDATE public.profiles SET vip_level = p_level, vip_assigned_by = auth.uid(), vip_assigned_at = now() WHERE id = p_target;
  INSERT INTO public.vip_audit_log (actor_id, target_user_id, action, old_level, new_level)
  VALUES (auth.uid(), p_target, 'assign', v_old, p_level);
  IF p_level > 0 AND p_level <> v_old THEN
    SELECT name_ar INTO v_tier_name FROM public.vip_tiers WHERE level = p_level;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (p_target, 'vip_promotion', '🎉 تم منحك مستوى VIP!',
      'مبروك! تم منحك مستوى ' || COALESCE(v_tier_name, '') || ' (LV ' || p_level || ') من إدارة الموقع',
      jsonb_build_object('new_level', p_level, 'old_level', v_old, 'manual', true));
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_revoke_vip(p_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_old int; v_spend numeric; v_new int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_target IS NULL THEN RAISE EXCEPTION 'invalid target'; END IF;
  SELECT vip_level, lifetime_spend INTO v_old, v_spend FROM public.profiles WHERE id = p_target;
  IF v_old IS NULL THEN RAISE EXCEPTION 'user not found'; END IF;
  SELECT COALESCE(MAX(level), 0) INTO v_new FROM public.vip_tiers WHERE spend_threshold <= COALESCE(v_spend, 0);
  UPDATE public.profiles SET vip_level = v_new, vip_assigned_by = NULL, vip_assigned_at = NULL WHERE id = p_target;
  INSERT INTO public.vip_audit_log (actor_id, target_user_id, action, old_level, new_level)
  VALUES (auth.uid(), p_target, 'revoke', v_old, v_new);
END;
$function$;


-- ===== 20260627085959_21e3aff8-1a12-493d-ab5d-52afe4433325.sql =====
CREATE OR REPLACE FUNCTION public.protect_vip_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND NOT public.is_admin(auth.uid()) THEN
    IF NEW.vip_level IS DISTINCT FROM OLD.vip_level THEN
      RAISE EXCEPTION 'forbidden: vip_level is read-only';
    END IF;
    IF NEW.vip_assigned_by IS DISTINCT FROM OLD.vip_assigned_by THEN
      RAISE EXCEPTION 'forbidden: vip_assigned_by is read-only';
    END IF;
    IF NEW.vip_assigned_at IS DISTINCT FROM OLD.vip_assigned_at THEN
      RAISE EXCEPTION 'forbidden: vip_assigned_at is read-only';
    END IF;
    IF NEW.lifetime_spend IS DISTINCT FROM OLD.lifetime_spend THEN
      RAISE EXCEPTION 'forbidden: lifetime_spend is read-only';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ===== 20260627090855_3d8cd165-5243-4ba0-9b48-c08dd3acb740.sql =====
DROP POLICY IF EXISTS "Users create own topups" ON public.topup_requests;
CREATE POLICY "Users create own topups" ON public.topup_requests
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending'::topup_status
  AND NOT is_banned(auth.uid())
  AND (
    (method = 'binance' AND amount >= 50)
    OR (method <> 'binance' AND amount >= 100)
  )
);

-- ===== 20260627193038_877e1891-f2ad-4b38-a640-88a34ea9fd41.sql =====

-- 1) Cron secret stored in DB; admin-only RLS, but service_role reads it.
INSERT INTO public.site_settings(key, value)
VALUES ('cron_secret', jsonb_build_object('value', encode(gen_random_bytes(32), 'hex')))
ON CONFLICT (key) DO NOTHING;

-- 2) Revoke EXECUTE from anon/public on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.get_effective_discount(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_assign_vip(uuid, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_vip(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_vip_tier(integer, text, text, numeric, numeric, text, text, text, numeric) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_vip_columns() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_order_vip() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purchase_product(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_purchase(uuid, uuid, text, numeric) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric, text, text, text, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gen_custom_id() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_banned(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;

-- 3) Allow authenticated users to delete/update their own topup receipt uploads
CREATE POLICY "Users delete own topup receipts"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'topup-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own topup receipts"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'topup-receipts' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'topup-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ===== 20260628002031_fd336b81-a316-4db4-a1c4-9433787f2e46.sql =====
CREATE OR REPLACE FUNCTION public.protect_vip_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow internal trigger cascades (e.g. handle_order_vip updating lifetime_spend / vip_level)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND NOT public.is_admin(auth.uid()) THEN
    IF NEW.vip_level IS DISTINCT FROM OLD.vip_level THEN
      RAISE EXCEPTION 'forbidden: vip_level is read-only';
    END IF;
    IF NEW.vip_assigned_by IS DISTINCT FROM OLD.vip_assigned_by THEN
      RAISE EXCEPTION 'forbidden: vip_assigned_by is read-only';
    END IF;
    IF NEW.vip_assigned_at IS DISTINCT FROM OLD.vip_assigned_at THEN
      RAISE EXCEPTION 'forbidden: vip_assigned_at is read-only';
    END IF;
    IF NEW.lifetime_spend IS DISTINCT FROM OLD.lifetime_spend THEN
      RAISE EXCEPTION 'forbidden: lifetime_spend is read-only';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ===== 20260630213446_c4d96590-120e-4594-9ddd-b1ed9f1dc927.sql =====
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refunded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reason text;

CREATE INDEX IF NOT EXISTS idx_orders_provider_pending
  ON public.orders (provider, status)
  WHERE status = 'pending';

-- ===== 20260630222521_3337d533-d146-4b22-adfb-047a439ebfb3.sql =====
ALTER TABLE public.products DROP CONSTRAINT products_provider_check;
ALTER TABLE public.products ADD CONSTRAINT products_provider_check CHECK (provider IS NULL OR provider IN ('brand1','x3'));

-- ===== 20260630225411_9321bbb4-1556-4a11-9f17-e3b3e3ad7839.sql =====

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


-- ===== 20260702111125_2f43d1ac-4a97-4683-8d40-7fe7e9ddce3b.sql =====
DROP FUNCTION IF EXISTS public.process_purchase(uuid, uuid, text);

-- ===== 20260704203906_dc0a3394-2580-46a5-85e6-6b260f7f0758.sql =====
ALTER TABLE public.telegram_chats ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;

-- ===== 20260708015923_6a006636-5f41-4dad-b333-19f2401ad323.sql =====
ALTER TABLE public.products DROP CONSTRAINT products_purchase_field_mode_check;
ALTER TABLE public.products ADD CONSTRAINT products_purchase_field_mode_check CHECK (purchase_field_mode = ANY (ARRAY['game_id'::text, 'subscription'::text, 'link'::text, 'none'::text]));

-- ===== 20260714034207_3463e866-10ae-4090-8812-7eca6145b7a5.sql =====
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_balance_check;

-- ===== 20260719224550_a24a2444-a2af-434d-aaa0-deb938f8079b.sql =====
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_usd numeric NULL CHECK (price_usd IS NULL OR price_usd >= 0);

-- ===== 20260724225100_48d13e39-f37f-400f-ad4b-8ebb162ce915.sql =====
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_provider_check;
ALTER TABLE public.products ADD CONSTRAINT products_provider_check CHECK (provider IS NULL OR provider IN ('brand1','x3','yassen'));

-- ===== 20260727084624_77fc519f-9277-464a-9039-65ca564f48da.sql =====
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS show_frame boolean NOT NULL DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS show_frame boolean NOT NULL DEFAULT true;

-- ===== 20260807205702_51d50632-c800-4fde-b709-76031927cc57.sql =====
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_provider_check;
ALTER TABLE public.products ADD CONSTRAINT products_provider_check CHECK (provider IS NULL OR provider IN ('brand1','x3','yassen','sama'));


ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_provider_check;
ALTER TABLE public.products ADD CONSTRAINT products_provider_check CHECK (provider IS NULL OR provider IN ('brand1','x3','yassen','sama','wisam'));

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
