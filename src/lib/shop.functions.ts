import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyTelegram } from "@/lib/telegram.server";

export const listShopProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, title, description, category, price, image_url, is_offer, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

const purchaseSchema = z.object({
  productId: z.string().uuid(),
  gameUserId: z.string().trim().min(1).max(120).optional(),
});

export const purchaseProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => purchaseSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: orderId, error } = await supabase.rpc("purchase_product", {
      p_product_id: data.productId,
      p_game_user_id: data.gameUserId,
    });
    if (error) throw new Error(error.message);

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
          `👤 ${prof?.full_name || prof?.email || userId}\n` +
          `📱 ${prof?.phone || "-"}\n` +
          `🎮 ${prod?.title}\n` +
          `💰 EG ${Number(prod?.price ?? 0).toLocaleString()}\n` +
          (data.gameUserId ? `🆔 ${data.gameUserId}\n` : "") +
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
    if (error) throw new Error(error.message);
    return data ?? [];
  });
