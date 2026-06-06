import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SIGNED_TTL = 60 * 60 * 24 * 7; // 7 days

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin"]);
  if (!data || data.length === 0) throw new Error("Forbidden");
}

async function withSignedUrl<T extends { image_url: string }>(rows: T[]): Promise<T[]> {
  return Promise.all(
    rows.map(async (r) => {
      if (/^https?:\/\//i.test(r.image_url)) return r;
      const { data } = await supabaseAdmin.storage.from("banners").createSignedUrl(r.image_url, SIGNED_TTL);
      return { ...r, image_url: data?.signedUrl ?? r.image_url };
    }),
  );
}

export const listActiveBanners = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("banners")
    .select("id, image_url, link_url, title, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return withSignedUrl(data ?? []);
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
    if (error) throw new Error(error.message);
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
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("banners").insert(data.data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), storagePath: z.string().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("banners").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.storagePath && !/^https?:\/\//i.test(data.storagePath)) {
      await supabaseAdmin.storage.from("banners").remove([data.storagePath]).catch(() => {});
    }
    return { ok: true };
  });

// Upload via base64 — keeps it simple and bypasses CORS on client uploads
const uploadSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(1).max(100),
  base64: z.string().min(1),
});

export const adminUploadBannerImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => uploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const ext = (data.filename.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = Buffer.from(data.base64, "base64");
    const { error } = await supabaseAdmin.storage.from("banners").upload(path, buf, {
      contentType: data.contentType,
      upsert: false,
    });
    if (error) throw new Error(error.message);
    return { path };
  });
