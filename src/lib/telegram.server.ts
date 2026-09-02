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

async function getChatIds(): Promise<string[]> {
  const envIds = (process.env.TELEGRAM_CHAT_ID ?? "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  let dbIds: string[] = [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("telegram_chats")
      .select("chat_id, enabled")
      .neq("enabled", false);
    dbIds = (data ?? []).map((r: { chat_id: string }) => r.chat_id);
  } catch (e) {
    console.error("Failed to load telegram_chats", e);
  }
  return Array.from(new Set([...envIds, ...dbIds]));
}

export async function notifyTelegram(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const chatIds = await getChatIds();
  if (chatIds.length === 0) return;

  await Promise.all(
    chatIds.map((chatId) => sendWithMigration(token, chatId, message)),
  );
}

async function sendWithMigration(token: string, chatId: string, message: string): Promise<void> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
    });
    if (res.ok) return;
    const body = await res.json().catch(() => ({}));
    const newId = body?.parameters?.migrate_to_chat_id;
    if (newId) {
      await persistMigratedChat(String(newId));
      const r2 = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: String(newId), text: message, parse_mode: "HTML" }),
      });
      if (!r2.ok) console.error("Telegram error after migrate", newId, r2.status, await r2.text());
      return;
    }
    console.error("Telegram error", chatId, res.status, JSON.stringify(body));
  } catch (e) {
    console.error("Telegram notify failed", chatId, e);
  }
}

async function persistMigratedChat(newId: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("telegram_chats").upsert({ chat_id: newId }, { onConflict: "chat_id" });
  } catch (e) {
    console.error("Failed to persist migrated chat", e);
  }
}

/** Send a photo (downloaded from a URL) with caption to all configured chats. */
export async function notifyTelegramPhoto(photoUrl: string, caption: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const chatIds = await getChatIds();
  if (chatIds.length === 0) return;

  // Download the image once and re-upload via multipart so private signed URLs work.
  let blob: Blob | null = null;
  try {
    const r = await fetch(photoUrl);
    if (r.ok) blob = await r.blob();
  } catch (e) {
    console.error("Failed to fetch photo for Telegram", e);
  }

  if (!blob) {
    await notifyTelegram(caption);
    return;
  }

  await Promise.all(chatIds.map((chatId) => sendPhotoWithMigration(token, chatId, blob, caption)));
}

async function sendPhotoWithMigration(token: string, chatId: string, blob: Blob, caption: string): Promise<void> {
  try {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("photo", blob, "receipt.jpg");
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form });
    if (res.ok) return;

    const body = await res.json().catch(() => ({}));
    const newId = body?.parameters?.migrate_to_chat_id;
    if (newId) {
      await persistMigratedChat(String(newId));
      const retryForm = new FormData();
      retryForm.append("chat_id", String(newId));
      retryForm.append("caption", caption);
      retryForm.append("parse_mode", "HTML");
      retryForm.append("photo", blob, "receipt.jpg");
      const retry = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: retryForm });
      if (!retry.ok) console.error("Telegram photo error after migrate", newId, retry.status, await retry.text());
      return;
    }

    console.error("Telegram photo error", chatId, res.status, JSON.stringify(body));
  } catch (e) {
    console.error("Telegram photo notify failed", chatId, e);
  }
}

// ---------------- Second (KYC) bot ----------------
// Secrets: KYC_TELEGRAM_BOT_TOKEN, KYC_TELEGRAM_CHAT_ID (comma separated allowed)
function kycChatIds(): string[] {
  return (process.env.KYC_TELEGRAM_CHAT_ID ?? "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Send a text message through the dedicated KYC bot. */
export async function notifyKycTelegram(message: string): Promise<void> {
  const token = process.env.KYC_TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const ids = kycChatIds();
  if (ids.length === 0) return;
  await Promise.all(
    ids.map(async (chatId) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
        });
        if (!res.ok) console.error("KYC telegram error", chatId, res.status, await res.text());
      } catch (e) {
        console.error("KYC telegram failed", chatId, e);
      }
    }),
  );
}

/** Send a caption plus one or more photos (downloaded from URLs) through the KYC bot. */
export async function notifyKycTelegramPhotos(photoUrls: string[], caption: string): Promise<void> {
  const token = process.env.KYC_TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const ids = kycChatIds();
  if (ids.length === 0) return;

  const blobs: Blob[] = [];
  for (const url of photoUrls) {
    try {
      const r = await fetch(url);
      if (r.ok) blobs.push(await r.blob());
    } catch (e) {
      console.error("KYC photo fetch failed", e);
    }
  }

  if (blobs.length === 0) {
    await notifyKycTelegram(caption);
    return;
  }

  await Promise.all(
    ids.map(async (chatId) => {
      try {
        for (let i = 0; i < blobs.length; i++) {
          const form = new FormData();
          form.append("chat_id", chatId);
          if (i === 0) {
            form.append("caption", caption);
            form.append("parse_mode", "HTML");
          }
          form.append("photo", blobs[i]!, `kyc-${i + 1}.jpg`);
          const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form });
          if (!res.ok) console.error("KYC photo error", chatId, res.status, await res.text());
        }
      } catch (e) {
        console.error("KYC photo send failed", chatId, e);
      }
    }),
  );
}
