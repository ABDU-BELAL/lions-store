// Brand1 Card provider client — server-only.
// Docs: https://api.brand1-card.com/api-docs

const BASE = process.env.BRAND1_API_BASE || "https://api.brand1-card.com";
const TOKEN = process.env.BRAND1_API_TOKEN || "";

type Json = Record<string, unknown>;

async function brand1Get(path: string, query?: Record<string, string | number | undefined>) {
  if (!TOKEN) throw new Error("BRAND1_API_TOKEN missing");
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
    console.error("[brand1]", res.status, body);
    throw new Error(`Brand1 HTTP ${res.status}`);
  }
  return body;
}

export interface Brand1ProductSummary {
  id: number | string;
  name: string;
  price?: number | string;
  category_id?: number | string;
  category_name?: string;
}

export async function brand1Profile() {
  return brand1Get("client/api/profile") as Promise<Json>;
}

export async function brand1ListProducts(): Promise<Brand1ProductSummary[]> {
  // Walk content/0 (root) and its categories to flatten all products.
  // Provider returns { status, data: { products: [...], categories: [...] } }
  const out: Brand1ProductSummary[] = [];
  const seen = new Set<string>();

  async function walk(catId: number | string) {
    const key = String(catId);
    if (seen.has(key)) return;
    seen.add(key);
    try {
      const body = (await brand1Get(`client/api/content/${catId}`)) as {
        data?: { products?: Brand1ProductSummary[]; categories?: { id: number | string; name?: string }[] };
      };
      const products = body.data?.products ?? [];
      for (const p of products) out.push(p);
      const cats = body.data?.categories ?? [];
      for (const c of cats) await walk(c.id);
    } catch (e) {
      console.warn("[brand1] walk failed for", catId, e);
    }
  }
  await walk(0);
  return out;
}

export interface Brand1NewOrderResult {
  ok: boolean;
  errorCode?: number;
  errorMessage?: string;
  orderId?: string;
  status?: "accept" | "reject" | "wait" | string;
  raw: Json;
}

export async function brand1NewOrder(args: {
  providerProductId: string;
  qty: number;
  playerId?: string;
  orderUuid: string;
}): Promise<Brand1NewOrderResult> {
  try {
    const body = (await brand1Get(`client/api/newOrder/${encodeURIComponent(args.providerProductId)}/params`, {
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

export async function brand1CheckOrder(providerOrderId: string): Promise<{ status?: string; raw: Json }> {
  const body = (await brand1Get(`client/api/check`, {
    orders: `[${providerOrderId}]`,
  })) as { data?: Array<{ status?: string }> };
  return { status: body.data?.[0]?.status, raw: body as Json };
}
