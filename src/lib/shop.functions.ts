import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { signMany } from "@/lib/storage.server";
import { notifyTelegram, escapeTelegramHtml } from "@/lib/telegram.server";
import { enforceRateLimit } from "@/lib/rate-limit.server";

export const listShopProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, title, description, category, price, image_url, is_offer, sort_order, collection_id, quantity_enabled, unit_size, unit_label, min_quantity, max_quantity")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
  return signMany("products", data ?? []);
});

// Returns the signed-in user's discount percent for a given product (0 if none).
export const getMyProductDiscount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ productId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("user_discounts")
      .select("percent")
      .eq("user_id", context.userId)
      .eq("product_id", data.productId)
      .maybeSingle();
    return { percent: row ? Number(row.percent) : 0 };
  });


const purchaseSchema = z.object({
  productId: z.string().uuid(),
  gameUserId: z.string().trim().min(1).max(120).optional(),
  quantity: z.number().positive().max(1_000_000_000).optional(),
});


export const purchaseProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => purchaseSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Rate limit purchases: max 10 per minute per user
    await enforceRateLimit(`purchase:${userId}`, 10, 60, "عدد كبير من المحاولات. حاول بعد قليل.");
    const { data: orderId, error } = await supabaseAdmin.rpc("process_purchase", {
      p_user_id: userId,
      p_product_id: data.productId,
      p_game_user_id: data.gameUserId,
      p_quantity: data.quantity ?? null,
    });
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };


    // Fire-and-forget notification
    try {
      const { data: prod } = await supabaseAdmin
        .from("products")
        .select("title")
        .eq("id", data.productId)
        .maybeSingle();
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("amount")
        .eq("id", orderId as string)
        .maybeSingle();
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("full_name, phone, email")
        .eq("id", userId)
        .maybeSingle();
      const qtyText = data.quantity != null ? String(data.quantity) : "1";
      const totalAmount = Number(order?.amount ?? 0);
      await notifyTelegram(
        `🛒 <b>طلب جديد</b>\n` +
          `👤 ${escapeTelegramHtml(prof?.full_name || prof?.email || userId)}\n` +
          `📱 ${escapeTelegramHtml(prof?.phone || "-")}\n` +
          `🎮 ${escapeTelegramHtml(prod?.title)}\n` +
          `🔢 الكمية: ${escapeTelegramHtml(qtyText)}\n` +
          `💰 EG ${escapeTelegramHtml(totalAmount.toLocaleString())}\n` +

          (data.gameUserId ? `🆔 ${escapeTelegramHtml(data.gameUserId)}\n` : "") +
          `#order_${String(orderId).slice(0, 8)}`,
      );
    } catch (e) {
      console.error("notify failed", e);
    }

    return { orderId: orderId as string };
  });

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("orders")
      .select("id, product_title, amount, status, game_user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    return data ?? [];
  });
