// Server-only Telegram notification helper.
// Configure these secrets in Cloud → Secrets:
//   TELEGRAM_BOT_TOKEN  — from @BotFather
//   TELEGRAM_CHAT_ID    — the group/channel id (e.g. -1001234567890)

/** Escape user-controlled text before embedding it into Telegram HTML messages. */
export function escapeTelegramHtml(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function notifyTelegram(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const envIds = (process.env.TELEGRAM_CHAT_ID ?? "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  let dbIds: string[] = [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("telegram_chats").select("chat_id");
    dbIds = (data ?? []).map((r: { chat_id: string }) => r.chat_id);
  } catch (e) {
    console.error("Failed to load telegram_chats", e);
  }

  const chatIds = Array.from(new Set([...envIds, ...dbIds]));
  if (chatIds.length === 0) return;

  await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
        });
        if (!res.ok) {
          console.error("Telegram error", chatId, res.status, await res.text());
        }
      } catch (e) {
        console.error("Telegram notify failed", chatId, e);
      }
    }),
  );
}

