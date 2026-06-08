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

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
