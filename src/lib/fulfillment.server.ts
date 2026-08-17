// Auto-fulfillment orchestration. Server-only — invoked from server fns + cron route.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { brand1NewOrder, brand1CheckOrder, brand1CheckByUuid } from "./brand1.server";
import { x3NewOrder, x3CheckOrder, x3CheckByUuid } from "./x3.server";
import { yassenNewOrder, yassenCheckOrder, yassenCheckByUuid } from "./yassen.server";
import { samaNewOrder, samaCheckOrder, samaCheckByUuid } from "./sama.server";
import { wisamNewOrder, wisamCheckOrder, wisamCheckByUuid } from "./wisam.server";
import { alshaikhNewOrder, alshaikhCheckOrder, alshaikhCheckByUuid } from "./alshaikh.server";
import { notifyTelegram, escapeTelegramHtml } from "./telegram.server";

const MAX_WAIT_MINUTES = 20;

type ProviderName = "brand1" | "x3" | "yassen" | "sama" | "wisam" | "alshaikh";

function newUuid(): string {
  return crypto.randomUUID();
}

interface OrderRow {
  id: string;
  user_id: string;
  product_id: string | null;
  product_title: string;
  amount: number | string;
  status: string;
  game_user_id: string | null;
  quantity: number | string | null;
  provider: string | null;
  provider_order_id: string | null;
  provider_uuid: string | null;
  provider_started_at: string | null;
  provider_attempts: number | null;
}

interface NewOrderResult {
  ok: boolean;
  orderId?: string;
  status?: string;
  errorMessage?: string;
  raw: Record<string, unknown>;
}

interface CheckResult {
  status?: string;
  orderId?: string;
  raw: Record<string, unknown>;
}

async function providerNewOrder(provider: ProviderName, args: { providerProductId: string; qty: number; playerId?: string; orderUuid: string }): Promise<NewOrderResult> {
  if (provider === "x3") return x3NewOrder(args);
  if (provider === "yassen") return yassenNewOrder(args);
  if (provider === "sama") return samaNewOrder(args);
  if (provider === "wisam") return wisamNewOrder(args);
  if (provider === "alshaikh") return alshaikhNewOrder(args);
  return brand1NewOrder(args);
}

async function providerCheck(provider: ProviderName, providerOrderId: string): Promise<CheckResult> {
  if (provider === "x3") return x3CheckOrder(providerOrderId);
  if (provider === "yassen") return yassenCheckOrder(providerOrderId);
  if (provider === "sama") return samaCheckOrder(providerOrderId);
  if (provider === "wisam") return wisamCheckOrder(providerOrderId);
  if (provider === "alshaikh") return alshaikhCheckOrder(providerOrderId);
  return brand1CheckOrder(providerOrderId);
}

async function providerCheckByUuid(provider: ProviderName, uuid: string): Promise<CheckResult> {
  try {
    if (provider === "x3") return await x3CheckByUuid(uuid);
    if (provider === "yassen") return await yassenCheckByUuid(uuid);
    if (provider === "sama") return await samaCheckByUuid(uuid);
    if (provider === "wisam") return await wisamCheckByUuid(uuid);
    if (provider === "alshaikh") return await alshaikhCheckByUuid(uuid);
    return await brand1CheckByUuid(uuid);
  } catch (e) {
    return { raw: { error: e instanceof Error ? e.message : "check failed" } };
  }
}

async function refundOrder(order: OrderRow, reason: string) {
  // Mark refunded flag first to prevent any chance of double-refund.
  const { data: marked, error: markErr } = await supabaseAdmin
    .from("orders")
    .update({ refunded: true, refunded_at: new Date().toISOString(), refund_reason: reason })
    .eq("id", order.id)
    .or("refunded.is.null,refunded.eq.false")
    .select("id")
    .maybeSingle();
  if (markErr) { console.error("[fulfillment] refund mark failed", markErr); throw new Error("Refund mark failed"); }
  if (!marked) {
    // Already refunded — skip.
    return;
  }
  const { error } = await supabaseAdmin.rpc("credit_wallet", {
    p_user_id: order.user_id,
    p_amount: Number(order.amount),
    p_type: "refund",
    p_description: `استرداد تلقائي: ${order.product_title}`,
    p_ref_table: "orders",
    p_ref_id: order.id,
  });
  if (error) {
    console.error("[fulfillment] refund credit failed", error);
    // Roll back the refunded flag so a future poll can retry.
    await supabaseAdmin.from("orders").update({ refunded: false, refunded_at: null, refund_reason: null }).eq("id", order.id);
    throw new Error("Refund failed: " + error.message);
  }
  notifyTelegram(
    `❌ تم رفض الطلب تلقائياً: ${escapeTelegramHtml(order.product_title)} — تم إرجاع EG ${escapeTelegramHtml(order.amount)} (${escapeTelegramHtml(reason)})`,
  ).catch(() => {});
}

async function alertAdmin(message: string) {
  notifyTelegram(`⚠️ <b>تنبيه</b>\n${message}`).catch(() => {});
}

/** Called immediately after a customer purchase. Returns true if an auto-attempt was made. */
export async function tryAutoFulfillOrder(orderId: string): Promise<{ attempted: boolean; finalStatus?: string }> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, product_id, product_title, amount, status, game_user_id, quantity, provider, provider_order_id, provider_uuid, provider_started_at, provider_attempts")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status !== "pending" || !order.product_id) return { attempted: false };
  if (order.provider) return { attempted: false };

  const { data: product } = await supabaseAdmin
    .from("products")
    .select("id, auto_fulfill_enabled, provider, provider_product_id")
    .eq("id", order.product_id)
    .maybeSingle();
  if (!product?.auto_fulfill_enabled || !product.provider || !product.provider_product_id) {
    return { attempted: false };
  }
  const provider = product.provider as ProviderName;
  if (provider !== "brand1" && provider !== "x3" && provider !== "yassen" && provider !== "sama" && provider !== "wisam" && provider !== "alshaikh") return { attempted: false };

  const uuid = newUuid();
  const { error: upErr } = await supabaseAdmin
    .from("orders")
    .update({
      provider,
      provider_uuid: uuid,
      provider_started_at: new Date().toISOString(),
      provider_attempts: 1,
    })
    .eq("id", orderId)
    .is("provider", null);
  if (upErr) {
    console.error("[fulfillment] reserve failed", upErr);
    return { attempted: false };
  }

  const qty = Number(order.quantity ?? 1) || 1;
  const result = await providerNewOrder(provider, {
    providerProductId: String(product.provider_product_id),
    qty,
    playerId: order.game_user_id ?? undefined,
    orderUuid: uuid,
  });

  await supabaseAdmin
    .from("orders")
    .update({
      provider_order_id: result.orderId ?? null,
      provider_status: result.status ?? (result.ok ? null : "error"),
      provider_reply: result.raw as never,
      provider_last_checked_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  // CRITICAL: If newOrder failed (network/timeout/no orderId), the provider may
  // STILL have created the order due to idempotency on order_uuid. Verify by
  // checking the uuid before refunding — otherwise we'd refund a fulfilled order.
  if (!result.ok || !result.orderId) {
    const recovered = await providerCheckByUuid(provider, uuid);
    if (recovered.orderId || recovered.status) {
      await supabaseAdmin
        .from("orders")
        .update({
          provider_order_id: recovered.orderId ?? null,
          provider_status: recovered.status ?? null,
          provider_reply: recovered.raw as never,
          provider_last_checked_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      if (recovered.status === "accept") {
        await supabaseAdmin.from("orders").update({ status: "completed" }).eq("id", orderId).eq("status", "pending");
        notifyTelegram(`✅ تنفيذ تلقائي ناجح (استرداد بعد فشل شبكة): ${escapeTelegramHtml(order.product_title)}`).catch(() => {});
        return { attempted: true, finalStatus: "completed" };
      }
      if (recovered.status === "reject") {
        await supabaseAdmin.from("orders").update({ status: "rejected" }).eq("id", orderId).eq("status", "pending");
        await refundOrder(order as OrderRow, "Provider rejected (recovered)");
        return { attempted: true, finalStatus: "rejected" };
      }
      // wait — leave pending; poll will follow up safely.
      return { attempted: true, finalStatus: "pending" };
    }
    // Provider has no visible record yet. Do NOT decline/refund here: some providers
    // can still accept/charge the order after returning an API error or timeout.
    // Keep the order pending and let polling/admin review confirm the real provider state.
    alertAdmin(
      `فشل رد مزود التنفيذ التلقائي — الطلب مازال معلّق للمراجعة ولا يتم رفضه تلقائياً\n` +
        `#order_${orderId.slice(0, 8)} uuid=${uuid}\n` +
        `السبب: ${escapeTelegramHtml(result.errorMessage ?? "Provider error")}`,
    );
    return { attempted: true, finalStatus: "pending" };
  }

  if (result.status === "accept") {
    await supabaseAdmin.from("orders").update({ status: "completed" }).eq("id", orderId).eq("status", "pending");
    notifyTelegram(`✅ تنفيذ تلقائي ناجح: ${escapeTelegramHtml(order.product_title)}`).catch(() => {});
    return { attempted: true, finalStatus: "completed" };
  }
  if (result.status === "reject") {
    await supabaseAdmin.from("orders").update({ status: "rejected" }).eq("id", orderId).eq("status", "pending");
    await refundOrder(order as OrderRow, "Provider rejected");
    return { attempted: true, finalStatus: "rejected" };
  }
  return { attempted: true, finalStatus: "pending" };
}

/** Poll all provider-pending orders. Refund if > MAX_WAIT_MINUTES. */
export async function pollPendingProviderOrders(): Promise<{ checked: number; completed: number; refunded: number; stillPending: number }> {
  const { data: rows } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, product_id, product_title, amount, status, game_user_id, quantity, provider, provider_order_id, provider_uuid, provider_started_at, provider_attempts")
    .eq("status", "pending")
    .in("provider", ["brand1", "x3", "yassen", "sama", "wisam", "alshaikh"])
    .limit(50);
  if (!rows || rows.length === 0) return { checked: 0, completed: 0, refunded: 0, stillPending: 0 };

  let completed = 0, refunded = 0, stillPending = 0;
  for (const order of rows as OrderRow[]) {
    try {
      const provider = order.provider as ProviderName;
      const startedAt = order.provider_started_at ? new Date(order.provider_started_at).getTime() : Date.now();
      const ageMin = (Date.now() - startedAt) / 60000;

      // If we don't have a provider_order_id, first try recovering via uuid (idempotency).
      // Do NOT refund just because newOrder didn't return one — the order may exist on the provider side.
      if (!order.provider_order_id) {
        if (!order.provider_uuid) {
          // Should not happen. Do not reject/refund automatically when provider state is unknown.
          if (ageMin >= MAX_WAIT_MINUTES) {
            alertAdmin(`طلب تنفيذ تلقائي بدون uuid بعد ${Math.floor(ageMin)} دقيقة — للمراجعة اليدوية\n#order_${order.id.slice(0,8)}`);
            stillPending++;
          } else { stillPending++; }
          continue;
        }
        const rec = await providerCheckByUuid(provider, order.provider_uuid);
        if (rec.orderId) {
          await supabaseAdmin.from("orders").update({
            provider_order_id: rec.orderId,
            provider_status: rec.status ?? null,
            provider_reply: rec.raw as never,
            provider_last_checked_at: new Date().toISOString(),
            provider_attempts: (order.provider_attempts ?? 0) + 1,
          }).eq("id", order.id);
          order.provider_order_id = rec.orderId;
          // fall through to status handling below
        } else {
          // Not found yet. After MAX_WAIT_MINUTES, alert admin instead of auto-refund.
          if (ageMin >= MAX_WAIT_MINUTES) {
            alertAdmin(`طلب لم يصل للمزود بعد ${Math.floor(ageMin)} دقيقة — للمراجعة اليدوية\n#order_${order.id.slice(0,8)} uuid=${order.provider_uuid}`);
            stillPending++;
          } else {
            stillPending++;
          }
          continue;
        }
      }

      const chk = await providerCheck(provider, order.provider_order_id!);
      await supabaseAdmin
        .from("orders")
        .update({
          provider_status: chk.status ?? null,
          provider_reply: chk.raw as never,
          provider_last_checked_at: new Date().toISOString(),
          provider_attempts: (order.provider_attempts ?? 0) + 1,
        })
        .eq("id", order.id);

      if (chk.status === "accept") {
        await supabaseAdmin.from("orders").update({ status: "completed" }).eq("id", order.id).eq("status", "pending");
        notifyTelegram(`✅ اكتمل طلب (poll): ${escapeTelegramHtml(order.product_title)}`).catch(() => {});
        completed++;
      } else if (chk.status === "reject") {
        await supabaseAdmin.from("orders").update({ status: "rejected" }).eq("id", order.id).eq("status", "pending");
        await refundOrder(order, "Provider rejected (poll)");
        refunded++;
      } else if (ageMin >= MAX_WAIT_MINUTES) {
        // Before taking any action on timeout, do a final uuid-check to be safe against status caching.
        if (order.provider_uuid) {
          const finalCheck = await providerCheckByUuid(provider, order.provider_uuid);
          if (finalCheck.status === "accept") {
            await supabaseAdmin.from("orders").update({ status: "completed" }).eq("id", order.id).eq("status", "pending");
            completed++;
            continue;
          }
          if (finalCheck.status === "reject") {
            await supabaseAdmin.from("orders").update({ status: "rejected" }).eq("id", order.id).eq("status", "pending");
            await refundOrder(order, `Provider rejected after ${MAX_WAIT_MINUTES} minutes`);
            refunded++;
            continue;
          }
        }
        // Unknown/waiting provider status is not proof of rejection. Keep pending.
        alertAdmin(`طلب مازال غير مؤكد بعد ${MAX_WAIT_MINUTES} دقيقة — لم يتم رفضه أو رد المبلغ تلقائياً\n#order_${order.id.slice(0,8)} uuid=${order.provider_uuid ?? "-"}`);
        stillPending++;
      } else {
        stillPending++;
      }
    } catch (e) {
      console.error("[fulfillment] poll error for", order.id, e);
      stillPending++;
    }
  }
  return { checked: rows.length, completed, refunded, stillPending };
}

/** Admin-triggered: re-read the provider's current state for one order (no auto refund). */
export async function recheckOrderWithProvider(orderId: string): Promise<{ providerStatus: string | null; providerOrderId: string | null }> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, provider, provider_order_id, provider_uuid")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.provider) return { providerStatus: null, providerOrderId: null };
  const provider = order.provider as ProviderName;
  let res: CheckResult = { raw: {} };
  if (order.provider_order_id) {
    try { res = await providerCheck(provider, order.provider_order_id); }
    catch (e) { res = { raw: { error: e instanceof Error ? e.message : "check failed" } }; }
  } else if (order.provider_uuid) {
    res = await providerCheckByUuid(provider, order.provider_uuid);
  }
  await supabaseAdmin
    .from("orders")
    .update({
      provider_order_id: res.orderId ?? order.provider_order_id ?? null,
      provider_status: res.status ?? null,
      provider_reply: res.raw as never,
      provider_last_checked_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  return { providerStatus: res.status ?? null, providerOrderId: res.orderId ?? order.provider_order_id ?? null };
}
