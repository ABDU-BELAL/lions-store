import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PartnerApiKeyRow = {
  id: string;
  label: string | null;
  active: boolean;
  last_used_at: string | null;
  created_at: string;
  key_prefix: string | null;
  has_secret: boolean;
};

async function assertPartner(
  supabase: { from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => Promise<{ data: unknown }> } } },
  userId: string,
) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return ((roles ?? []) as { role: string }[]).some((r) => r.role === "partner");
}

/** Returns ONLY the calling user's own API keys (masked — no secrets). */
export const getMyApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isPartner: boolean; keys: PartnerApiKeyRow[] }> => {
    const { supabase, userId } = context;
    if (!(await assertPartner(supabase as never, userId))) return { isPartner: false, keys: [] };

    const { partnerDb } = await import("@/lib/partner.server");
    const { data, error } = await partnerDb
      .from("partner_api_keys")
      .select("id, note, label, active, last_used_at, created_at, key_prefix, api_key_secret")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const keys: PartnerApiKeyRow[] = (data ?? []).map((k: Record<string, unknown>) => ({
      id: String(k.id),
      label: ((k.label ?? k.note) as string | null) ?? null,
      active: Boolean(k.active),
      last_used_at: (k.last_used_at as string | null) ?? null,
      created_at: String(k.created_at),
      key_prefix: (k.key_prefix as string | null) ?? null,
      has_secret: Boolean(k.api_key_secret),
    }));

    return { isPartner: true, keys };
  });

/** Reveals the plaintext token of one of the caller's OWN keys. */
export const revealMyApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ keyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ token: string }> => {
    const { supabase, userId } = context;
    if (!(await assertPartner(supabase as never, userId))) throw new Error("غير مصرح");

    const { partnerDb } = await import("@/lib/partner.server");
    const { data: row, error } = await partnerDb
      .from("partner_api_keys")
      .select("id, user_id, api_key_secret")
      .eq("id", data.keyId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.api_key_secret) {
      throw new Error("هذا المفتاح قديم ولا يمكن إظهاره. أنشئ مفتاحًا جديدًا.");
    }
    return { token: String(row.api_key_secret) };
  });

/** Partner generates (or regenerates) their own API token. */
export const generateMyApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ label: z.string().trim().max(80).optional() }).parse(input ?? {}))
  .handler(async ({ data, context }): Promise<{ token: string; keyId: string; prefix: string }> => {
    const { supabase, userId } = context;
    if (!(await assertPartner(supabase as never, userId))) throw new Error("غير مصرح");

    const { partnerDb, generateApiKey, hashApiKey } = await import("@/lib/partner.server");
    const raw = generateApiKey();
    const hashed = await hashApiKey(raw);
    const prefix = raw.slice(0, 10);

    const { data: inserted, error } = await partnerDb
      .from("partner_api_keys")
      .insert({
        user_id: userId,
        api_key_hash: hashed,
        api_key_secret: raw,
        key_prefix: prefix,
        note: data.label ?? "Self generated",
        active: true,
      })
      .select("id")
      .maybeSingle();
    if (error) { console.error("[generateMyApiKey]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); }

    return { token: raw, keyId: String(inserted?.id ?? ""), prefix };
  });

/** Partner can disable one of their own keys. */
export const revokeMyApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ keyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await assertPartner(supabase as never, userId))) throw new Error("غير مصرح");
    const { partnerDb } = await import("@/lib/partner.server");
    const { error } = await partnerDb
      .from("partner_api_keys")
      .update({ active: false })
      .eq("id", data.keyId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
