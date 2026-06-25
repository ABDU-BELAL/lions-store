import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/fulfillment-poll")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth: require Supabase anon key in apikey header (standard cron pattern).
        const apiKey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { "content-type": "application/json" },
          });
        }
        try {
          const { pollPendingProviderOrders } = await import("@/lib/fulfillment.server");
          const summary = await pollPendingProviderOrders();
          return Response.json({ ok: true, ...summary });
        } catch (e) {
          console.error("[fulfillment-poll]", e);
          return new Response(JSON.stringify({ error: "Internal error" }), {
            status: 500, headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
