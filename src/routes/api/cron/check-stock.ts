import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/check-stock")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        const expected = `Bearer ${process.env.CRON_SECRET}`;
        if (!process.env.CRON_SECRET || authHeader !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { syncProviderStock } = await import("@/lib/fulfillment.server");
        try {
          const result = await syncProviderStock();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          console.error("[cron/check-stock]", e);
          return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "unknown" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
