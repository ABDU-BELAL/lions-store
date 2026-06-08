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
  const chatIdsRaw = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatIdsRaw) return; // silently skip if not configured

  // Support multiple chat IDs separated by comma, semicolon, space, or newline
  const chatIds = chatIdsRaw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

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

