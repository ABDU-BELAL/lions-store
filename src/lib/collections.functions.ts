import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { signBucketPath, signMany } from "@/lib/storage.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "super_admin"]);
  if (!data || data.length === 0) throw new Error("Forbidden");
}

// ------- Public -------
export const listActiveCollections = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("collections")
    .select("id, slug, title, image_url, sort_order, show_on_home")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  return signMany("products", data ?? []);
});

export const getCollectionBySlug = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().trim().min(1).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const { data: col } = await supabaseAdmin
      .from("collections")
      .select("id, slug, title, image_url, is_active")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!col || !col.is_active) return null;
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, title, description, price, image_url, is_offer, category, sort_order, quantity_enabled, unit_size, unit_label, min_quantity, max_quantity")
      .eq("collection_id", col.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    const signedCol = { ...col, image_url: await signBucketPath("products", col.image_url) };
    const signedProducts = await signMany("products", products ?? []);
    return { collection: signedCol, products: signedProducts };
  });

// ------- Admin -------
const collectionSchema = z.object({
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/i, "Slug: letters/numbers/dash only"),
  title: z.string().trim().min(1).max(120),
  image_url: z.string().trim().max(1000).optional().nullable(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
  show_on_home: z.boolean().optional(),
});

export const adminListCollections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin.from("collections").select("*").order("sort_order").order("created_at", { ascending: false });
    return signMany("products", data ?? []);
  });

export const adminUpsertCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid().optional(), data: collectionSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin.from("collections").update(data.data).eq("id", data.id);
      if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    } else {
      const { error } = await supabaseAdmin.from("collections").insert(data.data);
      if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    }
    return { ok: true };
  });

export const adminDeleteCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("collections").delete().eq("id", data.id);
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    return { ok: true };
  });

// ------- Image upload (used for both products & collection thumbnails) -------
const uploadSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(1).max(100),
  base64: z.string().min(1),
});

export const adminUploadProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => uploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (!/^image\//i.test(data.contentType)) throw new Error("Only image files allowed");
    const ext = (data.filename.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = Buffer.from(data.base64, "base64");
    if (buf.byteLength > 5 * 1024 * 1024) throw new Error("Max 5MB");
    const { error } = await supabaseAdmin.storage.from("products").upload(path, buf, {
      contentType: data.contentType, upsert: false,
    });
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    return { path };
  });

// ------- Site settings -------
export type HomeSettings = {
  show_featured: boolean;
  show_offers: boolean;
  show_collections: boolean;
};

const DEFAULT_HOME: HomeSettings = { show_featured: true, show_offers: true, show_collections: true };

export const getHomeSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin.from("site_settings").select("value").eq("key", "home").maybeSingle();
  return { ...DEFAULT_HOME, ...((data?.value ?? {}) as Partial<HomeSettings>) } as HomeSettings;
});

export const adminUpdateHomeSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    show_featured: z.boolean(),
    show_offers: z.boolean(),
    show_collections: z.boolean(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("site_settings").upsert({ key: "home", value: data }, { onConflict: "key" });
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    return { ok: true };
  });
