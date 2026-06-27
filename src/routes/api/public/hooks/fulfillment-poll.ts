import { createFileRoute } from "@tanstack/react-router";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export const Route = createFileRoute("/api/public/hooks/fulfillment-poll")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!provided) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { "content-type": "application/json" },
          });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: row } = await supabaseAdmin
            .from("site_settings").select("value").eq("key", "cron_secret").maybeSingle();
          const expected = (row?.value as { value?: string } | null)?.value ?? "";
          if (!expected || !timingSafeEqual(provided, expected)) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401, headers: { "content-type": "application/json" },
            });
          }
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
