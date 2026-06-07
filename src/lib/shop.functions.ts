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
    .select("id, title, description, category, price, image_url, is_offer, sort_order, collection_id")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
  return signMany("products", data ?? []);
});

const purchaseSchema = z.object({
  productId: z.string().uuid(),
  gameUserId: z.string().trim().min(1).max(120).optional(),
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
    });
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };

    // Fire-and-forget notification
    try {
      const { data: prod } = await supabaseAdmin
        .from("products")
        .select("title, price")
        .eq("id", data.productId)
        .maybeSingle();
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("full_name, phone, email")
        .eq("id", userId)
        .maybeSingle();
      await notifyTelegram(
        `🛒 <b>طلب جديد</b>\n` +
          `👤 ${escapeTelegramHtml(prof?.full_name || prof?.email || userId)}\n` +
          `📱 ${escapeTelegramHtml(prof?.phone || "-")}\n` +
          `🎮 ${escapeTelegramHtml(prod?.title)}\n` +
          `💰 EG ${escapeTelegramHtml(Number(prod?.price ?? 0).toLocaleString())}\n` +
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
