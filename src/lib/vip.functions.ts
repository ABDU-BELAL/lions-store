import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyTelegram, escapeTelegramHtml } from "./telegram.server";
import { enforceRateLimit } from "./rate-limit.server";

async function assertSuperAdmin(userId: string) {
  if (!userId) throw new Error("Forbidden");
  const { data, error } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (error || data !== true) throw new Error("Forbidden: super admin only");
}

// Public: list 20 tiers (for everyone authenticated)
export const listVipTiers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("vip_tiers")
      .select("*")
      .order("level", { ascending: true });
    if (error) throw new Error("Failed to load tiers");
    return data ?? [];
  });

// Get my VIP info
export const getMyVip = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("vip_level, lifetime_spend, vip_assigned_by, vip_assigned_at")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      level: prof?.vip_level ?? 0,
      lifetimeSpend: Number(prof?.lifetime_spend ?? 0),
      manuallyAssigned: !!prof?.vip_assigned_by,
      assignedAt: prof?.vip_assigned_at ?? null,
    };
  });

// Admin: update a tier
export const adminUpdateVipTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      level: z.number().int().min(1).max(20),
      name_ar: z.string().trim().min(1).max(60).optional(),
      name_en: z.string().trim().min(1).max(60).optional(),
      discount_percent: z.number().min(0).max(100).optional(),
      spend_threshold: z.number().min(0).max(1_000_000_000).optional(),
      usd_spend_threshold: z.number().min(0).max(1_000_000_000).optional(),
      color_hex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      accent_hex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      badge_url: z.string().trim().max(300_000).refine(
        (v) => v === "" || /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/.test(v) || /^https?:\/\//.test(v),
        "صورة غير صالحة",
      ).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    await enforceRateLimit(`vip-tier-update:${context.userId}`, 30, 60, "محاولات كثيرة");
    const { error } = await supabaseAdmin.rpc("admin_update_vip_tier", {
      p_level: data.level,
      p_name_ar: data.name_ar,
      p_name_en: data.name_en,
      p_discount_percent: data.discount_percent,
      p_spend_threshold: data.spend_threshold,
      p_usd_spend_threshold: data.usd_spend_threshold,
      p_color_hex: data.color_hex,
      p_accent_hex: data.accent_hex,
      p_badge_url: data.badge_url,
    });
    if (error) { console.error("[adminUpdateVipTier]", error); throw new Error("فشل التحديث"); }
    return { ok: true };
  });

// Admin: assign VIP manually by custom_id or user_id
export const adminAssignVip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      customIdOrUserId: z.string().trim().min(1).max(80),
      level: z.number().int().min(0).max(20),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    await enforceRateLimit(`vip-assign:${context.userId}`, 20, 60, "محاولات كثيرة");

    // Resolve target
    const v = data.customIdOrUserId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    let targetId: string | null = null;
    let targetProfile: { full_name?: string | null; custom_id?: string | null; email?: string | null } | null = null;
    if (isUuid) {
      const { data: p } = await supabaseAdmin.from("profiles").select("id, full_name, custom_id, email").eq("id", v).maybeSingle();
      if (p) { targetId = p.id; targetProfile = p; }
    } else {
      const { data: p } = await supabaseAdmin.from("profiles").select("id, full_name, custom_id, email").eq("custom_id", v).maybeSingle();
      if (p) { targetId = p.id; targetProfile = p; }
    }
    if (!targetId) throw new Error("المستخدم غير موجود");

    const { error } = await supabaseAdmin.rpc("admin_assign_vip", { p_target: targetId, p_level: data.level });
    if (error) { console.error("[adminAssignVip]", error); throw new Error("فشل المنح"); }

    // Telegram transparency alert
    try {
      await notifyTelegram(
        `👑 <b>تخصيص VIP يدوي</b>\n` +
        `👤 ${escapeTelegramHtml(targetProfile?.full_name || targetProfile?.email || targetId)}\n` +
        `🆔 ${escapeTelegramHtml(targetProfile?.custom_id || "-")}\n` +
        `⭐ مستوى: LV ${data.level}`,
      );
    } catch { /* ignore */ }

    return { ok: true };
  });

// Admin: revoke manual VIP
export const adminRevokeVip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    await enforceRateLimit(`vip-revoke:${context.userId}`, 20, 60, "محاولات كثيرة");
    const { error } = await supabaseAdmin.rpc("admin_revoke_vip", { p_target: data.userId });
    if (error) { console.error("[adminRevokeVip]", error); throw new Error("فشل السحب"); }
    return { ok: true };
  });

// Public-ish: get pending VIP promotion notifications for the signed-in user
export const getUnreadVipPromotions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("notifications")
      .select("id, title, body, data, created_at")
      .eq("user_id", context.userId)
      .eq("type", "vip_promotion")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    return data?.[0] ?? null;
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await supabaseAdmin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });
