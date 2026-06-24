import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_BYTES = 5 * 1024 * 1024;

type DetectedImage = { ext: "jpg" | "png" | "webp" | "gif"; contentType: string } | null;

function detectImage(bytes: Uint8Array): DetectedImage {
  if (bytes.length < 12) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { ext: "png", contentType: "image/png" };
  }
  // GIF: 47 49 46 38 (37|39) 61
  if (
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
  ) {
    return { ext: "gif", contentType: "image/gif" };
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}

export const uploadTopupReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    if (!(input instanceof FormData)) throw new Error("Invalid form data");
    const file = input.get("file");
    if (!(file instanceof File)) throw new Error("File is required");
    if (file.size === 0) throw new Error("Empty file");
    if (file.size > MAX_BYTES) throw new Error("File too large (max 5MB)");
    return { file };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const buf = new Uint8Array(await data.file.arrayBuffer());
    const detected = detectImage(buf);
    if (!detected) {
      throw new Error("Invalid image file. Only JPG, PNG, GIF, or WebP are allowed.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${detected.ext}`;
    const { error } = await supabaseAdmin.storage
      .from("topup-receipts")
      .upload(path, buf, { contentType: detected.contentType, upsert: false });
    if (error) {
      console.error("[receipt upload]", error);
      throw new Error("Receipt upload failed");
    }
    return { path };
  });
