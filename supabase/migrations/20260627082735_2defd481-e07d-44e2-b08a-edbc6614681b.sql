
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
