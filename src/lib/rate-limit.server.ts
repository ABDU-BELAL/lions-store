import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Lightweight DB-backed rate limit. Counts events with the same `key` inside the
 * sliding window; throws if it exceeds `max`. Old rows are purged opportunistically.
 */
export async function enforceRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
  errorMessage = "تم تجاوز الحد المسموح به. حاول لاحقًا.",
) {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count } = await supabaseAdmin
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("key", key)
    .gte("created_at", since);

  if ((count ?? 0) >= max) {
    throw new Error(errorMessage);
  }

  await supabaseAdmin.from("rate_limits").insert({ key });

  // Best-effort cleanup of stale rows (keep 1h history)
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  supabaseAdmin.from("rate_limits").delete().lt("created_at", cutoff).then(() => {}, () => {});
}
