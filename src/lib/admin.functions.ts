import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyTelegram, escapeTelegramHtml } from "./telegram.server";

async function assertAdmin(userId: string): Promise<{ role: "admin" | "super_admin" }> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin"]);
  if (!data || data.length === 0) throw new Error("Forbidden: admin only");
  const isSuper = data.some((r) => r.role === "super_admin");
  return { role: isSuper ? "super_admin" : "admin" };
}

// Server-side verification used by route guards; throws if not an admin
export const verifyAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { role } = await assertAdmin(context.userId);
    return { role, isSuperAdmin: role === "super_admin" };
  });

// -------- Dashboard stats --------
export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [users, pendingTopups, approvedTopups, orders, products] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("topup_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("topup_requests").select("amount").eq("status", "approved"),
      supabaseAdmin.from("orders").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("products").select("id", { count: "exact", head: true }),
    ]);
    const revenue = (approvedTopups.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
    return {
      users: users.count ?? 0,
      pendingTopups: pendingTopups.count ?? 0,
      orders: orders.count ?? 0,
      products: products.count ?? 0,
      revenue,
    };
  });

// -------- Top-up management --------
export const listAllTopups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: "pending" | "approved" | "rejected" } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let q = supabaseAdmin
      .from("topup_requests")
      .select("id, user_id, amount, method, reference, note, status, admin_note, created_at, processed_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows } = await q;
    const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, email")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const map = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (rows ?? []).map((r) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });

export const decideTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
      adminNote: z.string().trim().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // Atomic claim: only succeeds if the row is still pending. Prevents
    // two concurrent admin approvals from double-crediting the wallet.
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("topup_requests")
      .update({
        status: data.decision,
        admin_note: data.adminNote ?? null,
        processed_by: context.userId,
        processed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "pending")
      .select("id, user_id, amount")
      .maybeSingle();
    if (claimError) throw new Error(claimError.message);
    if (!claimed) throw new Error("الطلب غير موجود أو تمت معالجته مسبقًا");

    if (data.decision === "approved") {
      // increment wallet
      const { data: wallet } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", claimed.user_id).maybeSingle();
      const newBalance = Number(wallet?.balance ?? 0) + Number(claimed.amount);
      const { error: e3 } = await supabaseAdmin
        .from("wallets")
        .upsert({ user_id: claimed.user_id, balance: newBalance }, { onConflict: "user_id" });
      if (e3) throw new Error(e3.message);
    }

    notifyTelegram(
      data.decision === "approved"
        ? `✅ تم قبول طلب شحن بقيمة ${escapeTelegramHtml(claimed.amount)} EGP`
        : `❌ تم رفض طلب شحن بقيمة ${escapeTelegramHtml(claimed.amount)} EGP`,
    ).catch(() => {});

    return { ok: true };
  });

// -------- Products CRUD --------
const productSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  image_url: z.string().trim().max(1000).optional(),
  category: z.string().trim().min(1).max(60),
  price: z.number().min(0).max(1_000_000),
  is_active: z.boolean().optional(),
  is_offer: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  collection_id: z.string().uuid().nullable().optional(),
});

export const adminListProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin.from("products").select("*").order("sort_order").order("created_at", { ascending: false });
    return data ?? [];
  });

export const adminUpsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid().optional(), data: productSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin.from("products").update(data.data).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("products").insert(data.data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Admin management (super admin only) --------
async function assertSuperAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin");
  if (!data || data.length === 0) throw new Error("Forbidden: super admin only");
}

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "super_admin"]);
    const ids = (roles ?? []).map((r) => r.user_id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, email")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const map = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (roles ?? []).map((r) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });

export const grantAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      email: z.string().email().toLowerCase(),
      role: z.enum(["admin", "super_admin"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: profile } = await supabaseAdmin.from("profiles").select("id").eq("email", data.email).maybeSingle();
    if (!profile) throw new Error("لا يوجد مستخدم بهذا الإيميل");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: profile.id, role: data.role }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["admin", "super_admin"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("لا تستطيع إزالة صلاحياتك بنفسك");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Bootstrap: first signed-in user can claim super_admin if none exists --------
export const claimSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin")
      .limit(1);
    if (existing && existing.length > 0) throw new Error("يوجد مالك للنظام بالفعل");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "super_admin" }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
