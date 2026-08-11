// Alshaikh provider client — server-only.
// Docs: https://api.alshaikh-store.com/api-docs
// Structurally identical to Brand1 / X3 / Yassen / Sama (api-token header, same endpoints).

const BASE = process.env.ALSHAIKH_API_BASE || "https://api.alshaikh-store.com";
const TOKEN = process.env.ALSHAIKH_API_TOKEN || "";

type Json = Record<string, unknown>;

async function alshaikhGet(path: string, query?: Record<string, string | number | undefined>) {
  if (!TOKEN) throw new Error("ALSHAIKH_API_TOKEN missing");
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
    console.error("[alshaikh]", res.status, body);
    throw new Error(`Alshaikh HTTP ${res.status}`);
  }
  return body;
}

export interface AlshaikhProductSummary {
  id: number | string;
  name: string;
  price?: number | string;
  category_id?: number | string;
  category_name?: string;
  qty_min?: number;
  qty_max?: number;
  product_type?: string;
}

export async function alshaikhProfile() {
  return alshaikhGet("client/api/profile") as Promise<Json>;
}

export async function alshaikhListProducts(): Promise<AlshaikhProductSummary[]> {
  const body = (await alshaikhGet("client/api/products")) as unknown;
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

export async function alshaikhGetProduct(providerProductId: string): Promise<AlshaikhProductSummary | null> {
  const all = await alshaikhListProducts();
  return all.find((p) => String(p.id) === String(providerProductId)) ?? null;
}

export interface AlshaikhNewOrderResult {
  ok: boolean;
  errorCode?: number;
  errorMessage?: string;
  orderId?: string;
  status?: "accept" | "reject" | "wait" | string;
  raw: Json;
}

export async function alshaikhNewOrder(args: {
  providerProductId: string;
  qty: number;
  playerId?: string;
  orderUuid: string;
}): Promise<AlshaikhNewOrderResult> {
  try {
    const body = (await alshaikhGet(`client/api/newOrder/${encodeURIComponent(args.providerProductId)}/params`, {
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

export async function alshaikhCheckOrder(providerOrderId: string): Promise<{ status?: string; orderId?: string; raw: Json }> {
  const body = (await alshaikhGet(`client/api/check`, { orders: `[${providerOrderId}]` })) as {
    data?: Array<{ status?: string; order_id?: string }>;
  };
  return { status: body.data?.[0]?.status, orderId: body.data?.[0]?.order_id, raw: body as Json };
}

/** Check order by our generated UUIDv4 (idempotent recovery after network failure). */
export async function alshaikhCheckByUuid(orderUuid: string): Promise<{ status?: string; orderId?: string; raw: Json }> {
  const body = (await alshaikhGet(`client/api/check`, { orders: `[${orderUuid}]`, uuid: 1 })) as {
    data?: Array<{ status?: string; order_id?: string }>;
  };
  return { status: body.data?.[0]?.status, orderId: body.data?.[0]?.order_id, raw: body as Json };
}
