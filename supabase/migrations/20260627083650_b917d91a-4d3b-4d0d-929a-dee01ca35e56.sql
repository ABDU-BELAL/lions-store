
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
