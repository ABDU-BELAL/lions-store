import { createStart, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { notifyTelegram, escapeTelegramHtml } from "./lib/telegram.server";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    // Structured log with request context
    let url = "unknown";
    let method = "unknown";
    try {
      const req = getRequest();
      url = req?.url ?? url;
      method = req?.method ?? method;
    } catch { /* no request context */ }
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(JSON.stringify({
      level: "error",
      kind: "unhandled_server_error",
      method,
      url,
      message,
      stack,
      at: new Date().toISOString(),
    }));
    // Best-effort alert to ops Telegram channel
    notifyTelegram(
      `🚨 <b>Server 500</b>\n<code>${escapeTelegramHtml(method)} ${escapeTelegramHtml(url)}</code>\n${escapeTelegramHtml(message)}`,
    ).catch(() => {});
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Security headers: CSP + clickjacking/MIME/referrer/permissions hardening.
// Applied to every server response (SSR pages, server fns, server routes).
const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const response = await next();
  const res = response as unknown as Response;
  if (!res || typeof res.headers?.set !== "function") return response;

  const contentType = res.headers.get("content-type") ?? "";
  const isHtml = contentType.includes("text/html");

  // Always-on headers
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // CSP only on HTML responses (don't pollute JSON/asset responses)
  if (isHtml) {
    const csp = [
      "default-src 'self'",
      // React/TanStack SSR hydration requires inline; keep unsafe-inline only for scripts/styles
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.lovable.app https://*.lovable.dev",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.lovable.app https://*.lovable.dev https://api.telegram.org",
      // Allow Lovable editor preview iframe; block all other framing
      "frame-ancestors 'self' https://*.lovable.app https://*.lovable.dev",
      "frame-src 'self' https://*.lovable.app https://*.lovable.dev",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ");
    res.headers.set("Content-Security-Policy", csp);
  }

  return response;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware, errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
