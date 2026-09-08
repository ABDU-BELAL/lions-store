import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertPartner(userId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    // 'partner' is added to app_role via self-host/03_partner_api.sql on the user's own DB;
    // generated types don't include it, so cast here.
    .eq("role", "partner" as "user")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: partner only");
}

/** Returns the current partner's own API key info (never the auto-generated raw key,
 * but includes the admin-set visible_key if one was manually entered for them). */
export const getMyPartnerKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPartner(context.userId);
    const { partnerDb } = await import("@/lib/partner.server");
    const { data, error } = await partnerDb
      .from("partner_api_keys")
      .select("id, key_prefix, active, created_at, last_used_at, visible_key")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) { console.error("[getMyPartnerKey]", error); throw new Error("حدث خطأ"); }
    return data ?? null;
  });
