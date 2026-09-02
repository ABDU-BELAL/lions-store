import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
// The kyc_requests table + profiles.kyc_status are applied via self-host SQL,
// so use an untyped client for those (generated types may not include them yet).
/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabaseAdmin as any;
const untyped = (c: unknown) => c as any;

import { notifyKycTelegram, notifyKycTelegramPhotos, escapeTelegramHtml } from "./telegram.server";

const MAX_BYTES = 6 * 1024 * 1024;

export const KYC_DOC_TYPES = ["passport", "id_card", "residence_permit"] as const;
export type KycDocType = (typeof KYC_DOC_TYPES)[number];

/** How many photos each document type requires, in order. */
export const KYC_SLOTS: Record<KycDocType, { ar: string; en: string }[]> = {
  passport: [
    { ar: "صورة جواز السفر", en: "Passport photo page" },
    { ar: "سيلفي وأنت ممسك بالجواز ووجهك ظاهر", en: "Selfie holding the passport, face visible" },
  ],
  id_card: [
    { ar: "وجه البطاقة", en: "ID card front" },
    { ar: "ظهر البطاقة", en: "ID card back" },
    { ar: "سيلفي وأنت ممسك بوجه البطاقة ووجهك ظاهر", en: "Selfie holding the ID front, face visible" },
  ],
  residence_permit: [
    { ar: "وجه الإقامة", en: "Residence permit front" },
    { ar: "ظهر الإقامة", en: "Residence permit back" },
    { ar: "سيلفي وأنت ممسك بالإقامة ووجهك ظاهر", en: "Selfie holding the permit, face visible" },
  ],
};

type Detected = { ext: "jpg" | "png" | "webp"; contentType: string } | null;
function detectImage(b: Uint8Array): Detected {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", contentType: "image/jpeg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", contentType: "image/png" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return { ext: "webp", contentType: "image/webp" };
  return null;
}

// -------- User: current KYC state --------
export const getMyKyc = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: latest }] = await Promise.all([
      untyped(supabase).from("profiles").select("kyc_status").eq("id", userId).maybeSingle(),
      untyped(supabase)
        .from("kyc_requests")
        .select("id, doc_type, status, admin_note, created_at, reviewed_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    return {
      status: ((profile as { kyc_status?: string } | null)?.kyc_status ?? "none") as
        | "none"
        | "pending"
        | "approved"
        | "rejected",
      latest: latest ?? null,
    };
  });

// -------- User: submit documents --------
export const submitKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    if (!(input instanceof FormData)) throw new Error("Invalid form data");
    const docType = String(input.get("doc_type") ?? "");
    if (!(KYC_DOC_TYPES as readonly string[]).includes(docType)) throw new Error("نوع المستند غير صالح");
    const fullName = String(input.get("full_name") ?? "").trim().slice(0, 120);
    const documentNumber = String(input.get("document_number") ?? "").trim().slice(0, 60);
    const files = input.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    const needed = KYC_SLOTS[docType as KycDocType].length;
    if (files.length !== needed) throw new Error(`مطلوب ${needed} صور`);
    for (const f of files) if (f.size > MAX_BYTES) throw new Error("حجم الصورة كبير (الحد 6 ميجا)");
    return { docType: docType as KycDocType, fullName, documentNumber, files };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: existing } = await untyped(supabase)
      .from("kyc_requests")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();
    if (existing) throw new Error("لديك طلب توثيق قيد المراجعة بالفعل");

    const paths: string[] = [];
    for (let i = 0; i < data.files.length; i++) {
      const buf = new Uint8Array(await data.files[i]!.arrayBuffer());
      const det = detectImage(buf);
      if (!det) throw new Error("ملف غير صالح، الصور المسموحة JPG أو PNG أو WebP فقط");
      const path = `${userId}/${Date.now()}-${i + 1}-${Math.random().toString(36).slice(2, 8)}.${det.ext}`;
      const { error } = await supabaseAdmin.storage
        .from("kyc-docs")
        .upload(path, buf, { contentType: det.contentType, upsert: false });
      if (error) {
        console.error("[kyc upload]", error);
        throw new Error("فشل رفع الصور، حاول مرة أخرى");
      }
      paths.push(path);
    }

    const { data: row, error: insErr } = await db
      .from("kyc_requests")
      .insert({
        user_id: userId,
        doc_type: data.docType,
        paths,
        full_name: data.fullName || null,
        document_number: data.documentNumber || null,
      })
      .select("id")
      .single();
    if (insErr) {
      console.error("[kyc insert]", insErr);
      throw new Error("حدث خطأ، حاول مرة أخرى");
    }

    await db.from("profiles").update({ kyc_status: "pending" }).eq("id", userId);

    // Notify the dedicated KYC Telegram bot with the photos.
    try {
      const { data: profile } = await db
        .from("profiles")
        .select("full_name, phone, email, custom_id")
        .eq("id", userId)
        .maybeSingle();
      const caption =
        `🪪 <b>طلب توثيق جديد (KYC)</b>\n` +
        `🆔 ${escapeTelegramHtml(profile?.custom_id ?? "—")}\n` +
        `👤 ${escapeTelegramHtml(profile?.full_name || data.fullName || "بدون اسم")}\n` +
        `✉️ ${escapeTelegramHtml(profile?.email || "—")}\n` +
        `📞 ${escapeTelegramHtml(profile?.phone || "—")}\n` +
        `📄 النوع: ${escapeTelegramHtml(data.docType)}\n` +
        `🔢 رقم المستند: ${escapeTelegramHtml(data.documentNumber || "—")}\n` +
        `#kyc_${escapeTelegramHtml(row.id)}`;
      const urls: string[] = [];
      for (const p of paths) {
        const { data: signed } = await supabaseAdmin.storage.from("kyc-docs").createSignedUrl(p, 60 * 60);
        if (signed?.signedUrl) urls.push(signed.signedUrl);
      }
      await notifyKycTelegramPhotos(urls, caption);
    } catch (e) {
      console.error("kyc telegram notify failed", e);
    }

    return { ok: true, id: row.id };
  });

// -------- Admin --------
async function assertAdmin(userId: string) {
  const { data } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin"]);
  if (!data || data.length === 0) throw new Error("Forbidden: admin only");
}

export const adminListKyc = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await db
      .from("kyc_requests")
      .select("id, user_id, doc_type, paths, full_name, document_number, status, admin_note, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    const rows: any[] = data ?? [];
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id)));
    const { data: profiles } = userIds.length
      ? await db.from("profiles").select("id, full_name, custom_id, phone").in("id", userIds)
      : { data: [] as { id: string; full_name: string | null; custom_id: string | null; phone: string | null }[] };
    const byId = new Map(((profiles ?? []) as any[]).map((p: any) => [p.id, p]));
    return Promise.all(
      rows.map(async (r: any) => {
        const urls: string[] = [];
        for (const p of r.paths ?? []) {
          const { data: signed } = await supabaseAdmin.storage.from("kyc-docs").createSignedUrl(p, 60 * 60);
          if (signed?.signedUrl) urls.push(signed.signedUrl);
        }
        const { paths: _omit, ...rest } = r;
        return { ...rest, urls, profile: byId.get(r.user_id) ?? null };
      }),
    );
  });

export const adminReviewKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["approve", "reject"]),
        note: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const status = data.action === "approve" ? "approved" : "rejected";
    const { data: row, error } = await db
      .from("kyc_requests")
      .update({ status, admin_note: data.note ?? null, reviewed_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("user_id")
      .single();
    if (error) {
      console.error("[kyc review]", error);
      throw new Error("حدث خطأ، حاول مرة أخرى");
    }
    await db.from("profiles").update({ kyc_status: status }).eq("id", row.user_id);
    await notifyKycTelegram(
      `${status === "approved" ? "✅" : "❌"} <b>مراجعة توثيق</b>\nالحالة: ${escapeTelegramHtml(status)}\n${escapeTelegramHtml(data.note ?? "")}`,
    ).catch(() => {});
    return { ok: true };
  });
