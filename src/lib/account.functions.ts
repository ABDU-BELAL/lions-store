import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notifyTelegram, escapeTelegramHtml } from "./telegram.server";

export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profileRes, walletRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("wallets").select("balance, updated_at").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    const profile = profileRes.data as
      | { id: string; full_name?: string | null; email?: string | null; phone?: string | null; custom_id?: string | null; is_banned?: boolean | null; notified_at?: string | null }
      | null;

    if (profile?.is_banned) {
      throw new Error("BANNED");
    }

    // First-time signup notification (best-effort, fires once)
    if (profile && !profile.notified_at) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: claimed } = await supabaseAdmin
          .from("profiles")
          .update({ notified_at: new Date().toISOString() })
          .eq("id", userId)
          .is("notified_at", null)
          .select("id")
          .maybeSingle();
        if (claimed) {
          notifyTelegram(
            `🆕 <b>مستخدم جديد سجّل</b>\n` +
              `🆔 ${escapeTelegramHtml(profile.custom_id ?? "—")}\n` +
              `👤 ${escapeTelegramHtml(profile.full_name || "بدون اسم")}\n` +
              `✉️ ${escapeTelegramHtml(profile.email || "—")}\n` +
              `📞 ${escapeTelegramHtml(profile.phone || "—")}`,
          ).catch(() => {});
        }
      } catch (e) {
        console.error("notify new user failed", e);
      }
    }

    const roles = (rolesRes.data ?? []).map((r) => r.role);
    return {
      profile,
      balance: walletRes.data?.balance ?? 0,
      roles,
      isAdmin: roles.includes("admin") || roles.includes("super_admin"),
      isSuperAdmin: roles.includes("super_admin"),
    };
  });
