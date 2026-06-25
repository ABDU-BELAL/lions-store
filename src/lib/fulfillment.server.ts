// Auto-fulfillment orchestration. Server-only — invoked from server fns + cron route.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { brand1NewOrder, brand1CheckOrder } from "./brand1.server";
import { notifyTelegram, escapeTelegramHtml } from "./telegram.server";

const MAX_WAIT_MINUTES = 20;

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

async function refundOrder(order: OrderRow, reason: string) {
  const { error } = await supabaseAdmin.rpc("credit_wallet", {
    p_user_id: order.user_id,
    p_amount: Number(order.amount),
    p_type: "refund",
    p_description: `استرداد تلقائي: ${order.product_title}`,
    p_ref_table: "orders",
    p_ref_id: order.id,
  });
  if (error) {
    console.error("[fulfillment] refund failed", error);
    throw new Error("Refund failed: " + error.message);
  }
  notifyTelegram(
    `❌ تم رفض الطلب تلقائياً: ${escapeTelegramHtml(order.product_title)} — تم إرجاع EG ${escapeTelegramHtml(order.amount)} (${escapeTelegramHtml(reason)})`,
  ).catch(() => {});
}

/** Called immediately after a customer purchase. Returns true if an auto-attempt was made. */
export async function tryAutoFulfillOrder(orderId: string): Promise<{ attempted: boolean; finalStatus?: string }> {
  // Load order + product mapping
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, product_id, product_title, amount, status, game_user_id, quantity, provider, provider_order_id, provider_uuid, provider_started_at, provider_attempts")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status !== "pending" || !order.product_id) return { attempted: false };
  if (order.provider) return { attempted: false }; // already attempted

  const { data: product } = await supabaseAdmin
    .from("products")
    .select("id, auto_fulfill_enabled, provider, provider_product_id")
    .eq("id", order.product_id)
    .maybeSingle();
  if (!product?.auto_fulfill_enabled || product.provider !== "brand1" || !product.provider_product_id) {
    return { attempted: false };
  }

  const uuid = newUuid();
  // Reserve provider fields atomically before calling out.
  const { error: upErr } = await supabaseAdmin
    .from("orders")
    .update({
      provider: "brand1",
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
  const result = await brand1NewOrder({
    providerProductId: String(product.provider_product_id),
    qty,
    playerId: order.game_user_id ?? undefined,
    orderUuid: uuid,
  });

  // Persist provider response
  await supabaseAdmin
    .from("orders")
    .update({
      provider_order_id: result.orderId ?? null,
      provider_status: result.status ?? (result.ok ? null : "error"),
      provider_reply: result.raw as never,
      provider_last_checked_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (!result.ok) {
    // Provider rejected the request outright — auto refund
    await supabaseAdmin.from("orders").update({ status: "rejected" }).eq("id", orderId).eq("status", "pending");
    await refundOrder(order as OrderRow, result.errorMessage ?? "Provider error");
    return { attempted: true, finalStatus: "rejected" };
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
  // status === wait → stays pending, cron will poll
  return { attempted: true, finalStatus: "pending" };
}

/** Poll all provider-pending orders. Refund if > MAX_WAIT_MINUTES. */
export async function pollPendingProviderOrders(): Promise<{ checked: number; completed: number; refunded: number; stillPending: number }> {
  const { data: rows } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, product_id, product_title, amount, status, game_user_id, quantity, provider, provider_order_id, provider_uuid, provider_started_at, provider_attempts")
    .eq("status", "pending")
    .eq("provider", "brand1")
    .limit(50);
  if (!rows || rows.length === 0) return { checked: 0, completed: 0, refunded: 0, stillPending: 0 };

  let completed = 0, refunded = 0, stillPending = 0;
  for (const order of rows as OrderRow[]) {
    try {
      const startedAt = order.provider_started_at ? new Date(order.provider_started_at).getTime() : Date.now();
      const ageMin = (Date.now() - startedAt) / 60000;

      // No provider_order_id means newOrder never returned one — treat as failure and refund.
      if (!order.provider_order_id) {
        if (ageMin >= 1) {
          await supabaseAdmin.from("orders").update({ status: "rejected" }).eq("id", order.id).eq("status", "pending");
          await refundOrder(order, "No provider order id");
          refunded++;
        } else { stillPending++; }
        continue;
      }

      const chk = await brand1CheckOrder(order.provider_order_id);
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
        await supabaseAdmin.from("orders").update({ status: "rejected" }).eq("id", order.id).eq("status", "pending");
        await refundOrder(order, `Timeout after ${MAX_WAIT_MINUTES} minutes`);
        refunded++;
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
