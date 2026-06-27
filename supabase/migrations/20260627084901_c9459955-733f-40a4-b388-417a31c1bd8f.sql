
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
