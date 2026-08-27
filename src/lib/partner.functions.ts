import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PartnerApiKeyRow = {
  id: string;
  label: string | null;
  active: boolean;
  last_used_at: string | null;
  created_at: string;
};

/** Returns ONLY the calling user's own API keys. Never returns other partners' data. */
export const getMyApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isPartner: boolean; keys: PartnerApiKeyRow[] }> => {
    const { supabase, userId } = context;

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isPartner = (roles ?? []).some((r) => (r as { role: string }).role === "partner");
    if (!isPartner) return { isPartner: false, keys: [] };

    const { partnerDb } = await import("@/lib/partner.server");
    const { data, error } = await partnerDb
      .from("partner_api_keys")
      .select("id, label, active, last_used_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const keys: PartnerApiKeyRow[] = (data ?? []).map((k: Record<string, unknown>) => ({
      id: String(k.id),
      label: (k.label as string | null) ?? null,
      active: Boolean(k.active),
      last_used_at: (k.last_used_at as string | null) ?? null,
      created_at: String(k.created_at),
    }));

    return { isPartner: true, keys };
  });
