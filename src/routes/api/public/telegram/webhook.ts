import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function deriveSecret(token: string): string {
  return createHash("sha256").update(`telegram-webhook:${token}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function sendMessage(token: string, chatId: number | string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.error("telegram reply failed", e);
  }
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) return new Response("Not configured", { status: 500 });

        const expected = deriveSecret(token);
        const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(actual, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const update = await request.json();
        const message = update.message ?? update.edited_message;
        const chat = message?.chat;
        if (!chat?.id) return Response.json({ ok: true });

        const chatId = String(chat.id);
        const text: string = (message.text ?? "").trim();
        const cmd = text.split(/\s+/)[0]?.toLowerCase();
        const title =
          chat.title ||
          [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
          chat.username ||
          null;

        if (cmd === "/start" || cmd === "/register") {
          const { error } = await supabaseAdmin
            .from("telegram_chats")
            .upsert({ chat_id: chatId, title }, { onConflict: "chat_id" });
          if (error) {
            await sendMessage(token, chat.id, `❌ Failed to register: ${error.message}`);
          } else {
            await sendMessage(
              token,
              chat.id,
              `✅ Registered! This chat will now receive notifications.\nSend /stop to unsubscribe.`,
            );
          }
        } else if (cmd === "/stop" || cmd === "/unregister") {
          await supabaseAdmin.from("telegram_chats").delete().eq("chat_id", chatId);
          await sendMessage(token, chat.id, "🛑 Unregistered. You will no longer receive notifications.");
        } else if (cmd === "/id") {
          await sendMessage(token, chat.id, `Your chat id: ${chatId}`);
        } else if (cmd === "/help") {
          await sendMessage(
            token,
            chat.id,
            "Commands:\n/start - register this chat for notifications\n/stop - stop notifications\n/id - show this chat id",
          );
        }

        return Response.json({ ok: true });
      },
    },
  },
});
