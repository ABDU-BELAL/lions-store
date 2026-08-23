import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/partner/products")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const {
          authenticatePartner, partnerDb, partnerError, partnerOk,
        } = await import("@/lib/partner.server");

        const auth = await authenticatePartner(request);
        if (auth instanceof Response) return auth;

        const { data, error } = await partnerDb
          .from("products")
          .select("id, title, title_en, price, price_usd, in_stock, quantity_enabled, unit_size, min_quantity, max_quantity")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });
        if (error) {
          console.error("[partner-api] products", error);
          return partnerError("server_error", "Internal error");
        }

        return partnerOk({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          products: (data ?? []).map((p: any) => ({
            id: p.id,
            name: p.title,
            name_en: p.title_en ?? null,
            price: Number(p.price),
            price_usd: p.price_usd == null ? null : Number(p.price_usd),
            stock: p.in_stock === false ? "out_of_stock" : "available",
            quantity_enabled: !!p.quantity_enabled,
            unit_size: p.unit_size == null ? null : Number(p.unit_size),
            min_quantity: p.min_quantity == null ? null : Number(p.min_quantity),
            max_quantity: p.max_quantity == null ? null : Number(p.max_quantity),
          })),
        });
      },
    },
  },
});
