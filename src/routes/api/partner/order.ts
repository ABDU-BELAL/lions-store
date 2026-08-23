import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/partner/order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          authenticatePartner, partnerDb, partnerError, partnerOk,
        } = await import("@/lib/partner.server");

        const auth = await authenticatePartner(request);
        if (auth instanceof Response) return auth;
        const partnerUserId = auth.userId;

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return partnerError("invalid_request", "Body must be valid JSON");
        }

        const { z } = await import("zod");
        const parsed = z
          .object({
            product_id: z.string().uuid(),
            quantity: z.coerce.number().positive().max(1_000_000_000).optional(),
            player_id: z.string().trim().max(300).optional(),
            order_uid: z.string().trim().min(3).max(120),
          })
          .safeParse(body);
        if (!parsed.success) {
          return partnerError("invalid_request", parsed.error.issues[0]?.message ?? "Invalid parameters");
        }
        const input = parsed.data;

        // Basic abuse guard: 120 order calls / minute per partner.
        try {
          const { enforceRateLimit } = await import("@/lib/rate-limit.server");
          await enforceRateLimit(`partner-order:${partnerUserId}`, 120, 60, "rate limited");
        } catch {
          return partnerError("rate_limited", "Too many requests");
        }

        // Product checks (clear error codes before touching the wallet).
        const { data: product } = await partnerDb
          .from("products")
          .select("id, title, price, is_active, in_stock, quantity_enabled, unit_size, min_quantity, max_quantity, purchase_field_mode")
          .eq("id", input.product_id)
          .maybeSingle();
        if (!product || product.is_active === false) {
          return partnerError("product_not_found", "Product not found");
        }
        if (product.in_stock === false) {
          return partnerError("out_of_stock", "Product is out of stock");
        }
        if (product.quantity_enabled && (input.quantity == null || input.quantity <= 0)) {
          return partnerError("invalid_request", "quantity is required for this product");
        }
        const mode = (product.purchase_field_mode as string | null) ?? "game_id";
        const playerId = (input.player_id ?? "").trim();
        if (mode !== "none" && !playerId) {
          return partnerError("invalid_request", "player_id is required for this product");
        }

        // Idempotency: (partner, order_uid) must be unique.
        const { data: dedupe, error: dedupeErr } = await partnerDb
          .from("partner_orders")
          .insert({ user_id: partnerUserId, order_uid: input.order_uid })
          .select("id")
          .maybeSingle();
        if (dedupeErr) {
          if (dedupeErr.code === "23505") {
            const { data: existing } = await partnerDb
              .from("partner_orders")
              .select("order_id")
              .eq("user_id", partnerUserId)
              .eq("order_uid", input.order_uid)
              .maybeSingle();
            return partnerError("duplicate_order", "order_uid already used", {
              order_id: existing?.order_id ?? null,
            });
          }
          console.error("[partner-api] dedupe insert", dedupeErr);
          return partnerError("server_error", "Internal error");
        }

        // Charge the partner wallet + create the order atomically (same RPC the
        // storefront uses: balance check, ledger row, order row).
        const { data: orderId, error: purchaseErr } = await partnerDb.rpc("process_purchase", {
          p_user_id: partnerUserId,
          p_product_id: input.product_id,
          p_game_user_id: mode === "none" ? undefined : playerId,
          p_quantity: product.quantity_enabled ? input.quantity : undefined,
        });

        if (purchaseErr || !orderId) {
          // Free the uid so the partner can retry the same reference.
          await partnerDb.from("partner_orders").delete().eq("id", dedupe?.id);
          const msg = purchaseErr?.message ?? "purchase failed";
          if (/insufficient/i.test(msg)) return partnerError("insufficient_balance", "Insufficient wallet balance");
          if (/not available|Product/i.test(msg)) return partnerError("product_not_found", "Product not available");
          if (/quantity/i.test(msg)) return partnerError("invalid_request", msg);
          if (/banned|تعليق/i.test(msg)) return partnerError("inactive_partner", "Partner account is suspended");
          console.error("[partner-api] purchase", purchaseErr);
          return partnerError("server_error", "Internal error");
        }

        await partnerDb.from("partner_orders").update({ order_id: orderId }).eq("id", dedupe?.id);

        const { data: order } = await partnerDb
          .from("orders")
          .select("id, status, amount, product_title, created_at")
          .eq("id", orderId as string)
          .maybeSingle();

        // Same auto-fulfillment pipeline as storefront orders.
        try {
          const { tryAutoFulfillOrder } = await import("@/lib/fulfillment.server");
          await tryAutoFulfillOrder(orderId as string);
        } catch (e) {
          console.error("[partner-api] auto-fulfill", e);
        }

        const { data: fresh } = await partnerDb
          .from("orders")
          .select("status")
          .eq("id", orderId as string)
          .maybeSingle();

        return partnerOk({
          order_id: orderId,
          order_uid: input.order_uid,
          product: order?.product_title ?? product.title,
          price: Number(order?.amount ?? 0),
          order_status: fresh?.status ?? order?.status ?? "pending",
        });
      },
    },
  },
});
