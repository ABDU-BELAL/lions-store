import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/check-orders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Vercel Cron sends this header automatically; also allow a manual
        // secret query param for testing. Reject anything else.
        const authHeader = request.headers.get("authorization");
        const expected = `Bearer ${process.env.CRON_SECRET}`;
        if (!process.env.CRON_SECRET || authHeader !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { pollPendingProviderOrders } = await import("@/lib/fulfillment.server");
        try {
          const result = await pollPendingProviderOrders();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          console.error("[cron/check-orders]", e);
          return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "unknown" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
