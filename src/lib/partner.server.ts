// Partner / reseller API helpers. Server-only.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PartnerErrorCode =
  | "invalid_token"
  | "inactive_partner"
  | "invalid_request"
  | "product_not_found"
  | "out_of_stock"
  | "insufficient_balance"
  | "duplicate_order"
  | "order_not_found"
  | "rate_limited"
  | "server_error";

const STATUS: Record<PartnerErrorCode, number> = {
  invalid_token: 401,
  inactive_partner: 403,
  invalid_request: 400,
  product_not_found: 404,
  out_of_stock: 409,
  insufficient_balance: 402,
  duplicate_order: 409,
  order_not_found: 404,
  rate_limited: 429,
  server_error: 500,
};

export function partnerError(code: PartnerErrorCode, message?: string, status?: number) {
  return new Response(
    JSON.stringify({ status: "error", code, message: message ?? code.replace(/_/g, " ") }),
    { status: status ?? STATUS[code], headers: { "content-type": "application/json" } },
  );
}

export function partnerOk(payload: Record<string, unknown>) {
  return new Response(JSON.stringify({ status: "ok", ...payload }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** SHA-256 hex — API keys are never stored in plaintext. */
export async function hashApiKey(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw.trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pk_${hex}`;
}

export interface PartnerContext {
  userId: string;
  keyId: string;
}

/** Reads the `api-token` header (or Authorization: Bearer) and resolves the partner. */
export async function authenticatePartner(request: Request): Promise<PartnerContext | Response> {
  const raw =
    request.headers.get("api-token") ??
    request.headers.get("x-api-token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (!raw.trim()) return partnerError("invalid_token", "Missing api-token header");

  const hashed = await hashApiKey(raw);
  const { data: key, error } = await supabaseAdmin
    .from("partner_api_keys")
    .select("id, user_id, active")
    .eq("api_key", hashed)
    .maybeSingle();
  if (error) {
    console.error("[partner-api] key lookup failed", error);
    return partnerError("server_error", "Internal error");
  }
  if (!key) return partnerError("invalid_token", "Invalid API token");
  if (!key.active) return partnerError("inactive_partner", "API key is disabled");

  const { data: banned } = await supabaseAdmin
    .from("profiles")
    .select("is_banned")
    .eq("id", key.user_id)
    .maybeSingle();
  if (banned?.is_banned) return partnerError("inactive_partner", "Partner account is suspended");

  supabaseAdmin
    .from("partner_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id)
    .then(() => {}, () => {});

  return { userId: key.user_id, keyId: key.id };
}
