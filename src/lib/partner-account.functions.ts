import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertPartner(userId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "partner")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: partner only");
}

/** Returns the current partner's own API key info (never the raw key). */
export const getMyPartnerKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPartner(context.userId);
    const { partnerDb } = await import("@/lib/partner.server");
    const { data, error } = await partnerDb
      .from("partner_api_keys")
      .select("id, key_prefix, active, created_at, last_used_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) { console.error("[getMyPartnerKey]", error); throw new Error("حدث خطأ"); }
    return data ?? null;
  });

/** Regenerates the current partner's API key. Invalidates the old one immediately.
 * Returns the new plaintext key ONCE (only the hash is stored). */
export const createMyPartnerKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPartner(context.userId);
    const { generateApiKey, hashApiKey, partnerDb } = await import("@/lib/partner.server");

    const { data: existing } = await partnerDb
      .from("partner_api_keys")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing) {
      throw new Error("لديك مفتاح بالفعل. تواصل مع الدعم لحذفه إن أردت مفتاحًا جديدًا.");
    }

    const raw = generateApiKey();
    const hashed = await hashApiKey(raw);
    const prefix = raw.slice(0, 10);

    const { error } = await partnerDb
      .from("partner_api_keys")
      .insert({ user_id: context.userId, api_key_hash: hashed, key_prefix: prefix, active: true });
    if (error) { console.error("[createMyPartnerKey]", error); throw new Error("حدث خطأ"); }

    return { apiKey: raw };
  });
