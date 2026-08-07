// Sama Card provider client — server-only.
// Docs: https://api.samacard.com/api-docs
// Structurally identical to Brand1 / X3 / Yassen (api-token header, same endpoints).

const BASE = process.env.SAMA_API_BASE || "https://api.samacard.com";
const TOKEN = process.env.SAMA_API_TOKEN || "";

type Json = Record<string, unknown>;

async function samaGet(path: string, query?: Record<string, string | number | undefined>) {
  if (!TOKEN) throw new Error("SAMA_API_TOKEN missing");
  const url = new URL(path.replace(/^\//, ""), BASE.endsWith("/") ? BASE : BASE + "/");
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "api-token": TOKEN, accept: "application/json" },
  });
  const text = await res.text();
  let body: Json = {};
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!res.ok) {
    console.error("[sama]", res.status, body);
    throw new Error(`Sama HTTP ${res.status}`);
  }
  return body;
}

export interface SamaProductSummary {
  id: number | string;
  name: string;
  price?: number | string;
  category_id?: number | string;
  category_name?: string;
  qty_min?: number;
  qty_max?: number;
  product_type?: string;
}

export async function samaProfile() {
  return samaGet("client/api/profile") as Promise<Json>;
}

export async function samaListProducts(): Promise<SamaProductSummary[]> {
  const body = (await samaGet("client/api/products")) as unknown;
  let arr: unknown[] = [];
  if (Array.isArray(body)) arr = body;
  else if (body && typeof body === "object") {
    const maybeData = (body as { data?: unknown }).data;
    if (Array.isArray(maybeData)) arr = maybeData;
  }
  return arr.map((p) => {
    const o = p as Record<string, unknown>;
    const qvRaw = o.qty_values;
    const qv = (Array.isArray(qvRaw) ? {} : (qvRaw ?? {})) as { min?: string | number; max?: string | number };
    const toNum = (v: unknown) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    return {
      id: (o.id as number | string) ?? "",
      name: String(o.name ?? o.category_name ?? `#${o.id}`),
      price: o.price as number | string | undefined,
      category_id: o.parent_id as number | string | undefined,
      category_name: o.category_name as string | undefined,
      qty_min: toNum(qv?.min),
      qty_max: toNum(qv?.max),
      product_type: o.product_type as string | undefined,
    };
  }).filter((p) => p.id !== "");
}

export async function samaGetProduct(providerProductId: string): Promise<SamaProductSummary | null> {
  const all = await samaListProducts();
  return all.find((p) => String(p.id) === String(providerProductId)) ?? null;
}

export interface SamaNewOrderResult {
  ok: boolean;
  errorCode?: number;
  errorMessage?: string;
  orderId?: string;
  status?: "accept" | "reject" | "wait" | string;
  raw: Json;
}

export async function samaNewOrder(args: {
  providerProductId: string;
  qty: number;
  playerId?: string;
  orderUuid: string;
}): Promise<SamaNewOrderResult> {
  try {
    const body = (await samaGet(`client/api/newOrder/${encodeURIComponent(args.providerProductId)}/params`, {
      qty: args.qty,
      playerId: args.playerId,
      order_uuid: args.orderUuid,
    })) as { status?: string; code?: number; message?: string; data?: { order_id?: string; status?: string } };
    if (body.status !== "OK") {
      return { ok: false, errorCode: body.code, errorMessage: body.message ?? "Provider error", raw: body };
    }
    return {
      ok: true,
      orderId: body.data?.order_id,
      status: body.data?.status,
      raw: body,
    };
  } catch (e) {
    return { ok: false, errorMessage: e instanceof Error ? e.message : "Network error", raw: {} };
  }
}

export async function samaCheckOrder(providerOrderId: string): Promise<{ status?: string; orderId?: string; raw: Json }> {
  const body = (await samaGet(`client/api/check`, { orders: `[${providerOrderId}]` })) as {
    data?: Array<{ status?: string; order_id?: string }>;
  };
  return { status: body.data?.[0]?.status, orderId: body.data?.[0]?.order_id, raw: body as Json };
}

/** Check order by our generated UUIDv4 (idempotent recovery after network failure). */
export async function samaCheckByUuid(orderUuid: string): Promise<{ status?: string; orderId?: string; raw: Json }> {
  const body = (await samaGet(`client/api/check`, { orders: `[${orderUuid}]`, uuid: 1 })) as {
    data?: Array<{ status?: string; order_id?: string }>;
  };
  return { status: body.data?.[0]?.status, orderId: body.data?.[0]?.order_id, raw: body as Json };
}
