import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/partner/order/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const {
          authenticatePartner, partnerDb, partnerError, partnerOk,
        } = await import("@/lib/partner.server");

        const auth = await authenticatePartner(request);
        if (auth instanceof Response) return auth;

        const id = String(params.id ?? "").trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        let orderId = id;
        if (!isUuid) {
          // Allow lookup by the partner's own order_uid.
          const { data: ref } = await partnerDb
            .from("partner_orders")
            .select("order_id")
            .eq("user_id", auth.userId)
            .eq("order_uid", id)
            .maybeSingle();
          if (!ref?.order_id) return partnerError("order_not_found", "Order not found");
          orderId = ref.order_id as string;
        }

        const { data: order, error } = await partnerDb
          .from("orders")
          .select("id, status, amount, product_title, quantity, game_user_id, provider, provider_status, created_at, refunded")
          .eq("id", orderId)
          .eq("user_id", auth.userId)
          .maybeSingle();
        if (error) {
          console.error("[partner-api] order status", error);
          return partnerError("server_error", "Internal error");
        }
        if (!order) return partnerError("order_not_found", "Order not found");

        const { data: ref } = await partnerDb
          .from("partner_orders")
          .select("order_uid")
          .eq("order_id", order.id)
          .maybeSingle();

        return partnerOk({
          order_id: order.id,
          order_uid: ref?.order_uid ?? null,
          product: order.product_title,
          quantity: order.quantity == null ? null : Number(order.quantity),
          player_id: order.game_user_id ?? null,
          price: Number(order.amount),
          order_status: order.status,
          provider_status: order.provider_status ?? null,
          refunded: !!order.refunded,
          created_at: order.created_at,
        });
      },
    },
  },
});
