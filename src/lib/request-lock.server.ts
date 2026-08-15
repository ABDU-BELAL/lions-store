// Server-only idempotency guard: blocks the same action being submitted twice
// (double-click / double-submit / retry) within a short window.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Tries to claim a short-lived lock for `key`.
 * Throws `message` when the same key was claimed within `windowSeconds`.
 */
export async function claimRequestLock(key: string, windowSeconds: number, message: string) {
  const { data, error } = await supabaseAdmin.rpc("claim_request_lock", {
    p_key: key,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[request-lock]", error);
    return; // fail open — never block a legit action because of infra errors
  }
  if (data !== true) throw new Error(message);
}
