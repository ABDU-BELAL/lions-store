import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { signPaths } from "@/lib/storage.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin"]);
  if (!data || data.length === 0) throw new Error("Forbidden");
}

async function withSignedUrl<T extends { image_url: string }>(rows: T[]): Promise<T[]> {
  const map = await signPaths("banners", rows.map((r) => r.image_url));
  return rows.map((r) => ({ ...r, image_url: map.get(r.image_url) ?? r.image_url }));
}


export const listActiveBanners = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("banners")
    .select("id, image_url, link_url, title, title_en, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  // Banners are decorative: never break the homepage if the backend is unreachable.
  if (error) { console.error("[db]", error); return []; }
  try {
    return await withSignedUrl(data ?? []);
  } catch (e) {
    console.error("[banners:sign]", e);
    return data ?? [];
  }
});

export const adminListBanners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("banners")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    return withSignedUrl(data ?? []);
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  data: z.object({
    image_url: z.string().trim().min(1).max(1000),
    link_url: z
      .string().trim().max(1000)
      .refine((v) => !v || /^https?:\/\//i.test(v), { message: "Only http/https URLs allowed" })
      .optional()
      .nullable(),
    title: z.string().trim().max(120).optional().nullable(),
    title_en: z.string().trim().max(120).optional().nullable(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().optional(),
  }),
});

export const adminUpsertBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin.from("banners").update(data.data).eq("id", data.id);
      if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    } else {
      const { error } = await supabaseAdmin.from("banners").insert(data.data);
      if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    }
    return { ok: true };
  });

export const adminDeleteBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), storagePath: z.string().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("banners").delete().eq("id", data.id);
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    if (data.storagePath && !/^https?:\/\//i.test(data.storagePath)) {
      await supabaseAdmin.storage.from("banners").remove([data.storagePath]).catch(() => {});
    }
    return { ok: true };
  });

// Upload via base64 — keeps it simple and bypasses CORS on client uploads
const uploadSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(1).max(100).regex(/^image\//i, "Only image files allowed"),
  base64: z.string().min(1),
});

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const adminUploadBannerImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => uploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const ext = (data.filename.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = Buffer.from(data.base64, "base64");
    if (buf.byteLength === 0) throw new Error("الملف فارغ");
    if (buf.byteLength > MAX_UPLOAD_BYTES) throw new Error("الحد الأقصى 5 ميجابايت");
    const { error } = await supabaseAdmin.storage.from("banners").upload(path, buf, {
      contentType: data.contentType,
      upsert: false,
    });
    if (error) {
      console.error("[adminUploadBannerImage]", error);
      throw new Error("فشل رفع الصورة");
    }
    return { path };
  });
