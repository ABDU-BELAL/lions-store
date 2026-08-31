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
    .select("id, title, title_en, description, description_en, category, price, price_usd, image_url, is_offer, sort_order, collection_id, quantity_enabled, unit_size, unit_label, min_quantity, max_quantity, purchase_field_mode, in_stock, show_frame")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  // Never blank-screen the shop if the backend is unreachable.
  if (error) { console.error("[db]", error); return []; }
  try {
    return await signMany("products", data ?? []);
  } catch (e) {
    console.error("[products:sign]", e);
    return data ?? [];
  }
});

// Returns the signed-in user's EFFECTIVE discount for a given product
// (MAX of manual user_discount and VIP tier discount). 0 if none.
export const getMyProductDiscount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ productId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: pct } = await supabaseAdmin.rpc("get_effective_discount", {
      p_user_id: context.userId,
      p_product_id: data.productId,
    });
    return { percent: Number(pct ?? 0) };
  });


const purchaseSchema = z.object({
  productId: z.string().uuid(),
  gameUserId: z.string().trim().max(300).optional(),
  quantity: z.number().positive().max(1_000_000_000).optional(),
});


export const purchaseProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => purchaseSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Rate limit purchases: max 10 per minute per user
    await enforceRateLimit(`purchase:${userId}`, 10, 60, "عدد كبير من المحاولات. حاول بعد قليل.");

    // Validate the customer-input field per the product's purchase_field_mode
    const { data: modeRow } = await supabaseAdmin
      .from("products")
      .select("purchase_field_mode")
      .eq("id", data.productId)
      .maybeSingle();
    const mode = (modeRow?.purchase_field_mode as "game_id" | "subscription" | "link" | "none" | undefined) ?? "game_id";
    const trimmed = (data.gameUserId ?? "").trim();
    if (mode === "game_id") {
      if (!trimmed) throw new Error("ID is missing");
    } else if (mode === "subscription") {
      if (!trimmed) throw new Error("Email is missing");
      const parts = trimmed.split(/\s\|\s/);
      const email = (parts[0] ?? "").trim();
      const password = (parts[1] ?? "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");
      if (!password) throw new Error("Password is missing");
    } else if (mode === "link") {
      if (!trimmed) throw new Error("Link is required");
      if (!/^https?:\/\/.+/i.test(trimmed)) throw new Error("Invalid link");
    }
    const gameUserIdToStore = mode === "none" ? null : trimmed;

    const { data: orderId, error } = await supabaseAdmin.rpc("process_purchase", {
      p_user_id: userId,
      p_product_id: data.productId,
      p_game_user_id: gameUserIdToStore ?? undefined,
      p_quantity: data.quantity ?? undefined,
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

          (data.gameUserId
            ? (mode === "subscription"
                ? (() => {
                    const parts = data.gameUserId!.split(/\s\|\s/);
                    const email = (parts[0] ?? "").trim();
                    const password = (parts[1] ?? "").trim();
                    return `📧 ${escapeTelegramHtml(email)}\n🔑 ${escapeTelegramHtml(password)}\n`;
                  })()
                : mode === "link"
                ? `🔗 ${escapeTelegramHtml(data.gameUserId)}\n`
                : `🆔 ${escapeTelegramHtml(data.gameUserId)}\n`)
            : "") +
          `#order_${String(orderId).slice(0, 8)}`,
      );
    } catch (e) {
      console.error("notify failed", e);
    }

    // Auto-fulfillment via provider (Brand1) — fire-and-forget; safe no-op if not configured.
    try {
      const { tryAutoFulfillOrder } = await import("./fulfillment.server");
      await tryAutoFulfillOrder(orderId as string);
    } catch (e) {
      console.error("[auto-fulfill]", e);
    }

    return { orderId: orderId as string };
  });

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("orders")
      .select("id, product_title, amount, status, game_user_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    return data ?? [];
  });
