import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Returns ONLY the calling user's own API keys. Never returns other partners' data. */
export const getMyApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isPartner = (roles ?? []).some((r) => (r as { role: string }).role === "partner");
    if (!isPartner) return { isPartner: false, keys: [] as Array<Record<string, unknown>> };

    const { partnerDb } = await import("@/lib/partner.server");
    const { data, error } = await partnerDb
      .from("partner_api_keys")
      .select("id, label, active, last_used_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return { isPartner: true, keys: data ?? [] };
  });
