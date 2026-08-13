import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Only public catalog buckets may be served here. Receipts stay private.
const ALLOWED = new Set(["products", "banners"]);

export const Route = createFileRoute("/api/public/img/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        const decoded = decodeURIComponent(splat);
        const slash = decoded.indexOf("/");
        if (slash <= 0) return new Response("Not found", { status: 404 });

        const bucket = decoded.slice(0, slash);
        const path = decoded.slice(slash + 1);
        if (!ALLOWED.has(bucket) || !path || path.includes("..")) {
          return new Response("Not found", { status: 404 });
        }

        const slash = decoded.indexOf("/");
        if (slash <= 0) return new Response(JSON.stringify({ debug: true, splat, decoded, slash }), { status: 404 });

        return new Response(await data.arrayBuffer(), {
          headers: {
            "Content-Type": data.type || "image/jpeg",
            // Immutable: uploads always get a fresh unique filename.
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
