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
    if (claimError) { console.error("[db]", claimError); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    if (!claimed) throw new Error("الطلب غير موجود أو تمت معالجته مسبقًا");

    if (data.decision === "approved") {
      // Atomic credit via SECURITY DEFINER function that locks the wallet row.
      const { error: e3 } = await supabaseAdmin.rpc("credit_wallet", {
        p_user_id: claimed.user_id,
        p_amount: Number(claimed.amount),
        p_type: "deposit",
        p_description: "شحن رصيد",
        p_ref_table: "topup_requests",
        p_ref_id: claimed.id,
      });
      if (e3) {
        console.error("[decideTopup] credit_wallet", e3);
        throw new Error("تعذر إضافة الرصيد");
      }
    }

    await notifyTelegram(
      data.decision === "approved"
        ? `✅ تم قبول طلب شحن بقيمة ${escapeTelegramHtml(claimed.amount)} EGP`
        : `❌ تم رفض طلب شحن بقيمة ${escapeTelegramHtml(claimed.amount)} EGP`,
    ).catch((err) => console.error("topup decision telegram notify failed", err));

    return { ok: true };
  });

// -------- Products CRUD --------
const productSchema = z.object({
  title: z.string().trim().min(1).max(120),
  title_en: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(1000).optional(),
  description_en: z.string().trim().max(1000).optional().nullable(),
  image_url: z.string().trim().max(1000).optional(),
  category: z.string().trim().min(1).max(60),
  price: z.number().min(0).max(10_000_000),
  price_usd: z.number().min(0).max(10_000_000).nullable().optional(),
  is_active: z.boolean().optional(),
  in_stock: z.boolean().optional(),
  show_frame: z.boolean().optional(),
  is_offer: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  collection_id: z.string().uuid().nullable().optional(),
  quantity_enabled: z.boolean().optional(),
  unit_size: z.number().positive().max(1_000_000).optional(),
  unit_label: z.string().trim().max(40).nullable().optional(),
  min_quantity: z.number().positive().max(1_000_000_000).nullable().optional(),
  max_quantity: z.number().positive().max(1_000_000_000).nullable().optional(),
  purchase_field_mode: z.enum(["game_id", "subscription", "link", "none"]).optional(),
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
    const payload: typeof data.data = { ...data.data };
    const hasEgp = Number(payload.price) > 0;
    const hasUsd = payload.price_usd != null && Number(payload.price_usd) > 0;
    if (!hasEgp && !hasUsd) {
      throw new Error("أدخل السعر بالجنيه أو بالدولار على الأقل / Enter EGP or USD price");
    }
    // Look up manual USD→EGP rate for auto-conversion when only one side is provided.
    const { data: rateRow } = await supabaseAdmin.from("site_settings").select("value").eq("key", "usd_rate").maybeSingle();
    const rate = Number((rateRow?.value as { rate?: number } | null)?.rate ?? 0);
    if (!hasEgp && hasUsd) {
      if (!(rate > 0)) throw new Error("حدد سعر الدولار اليدوي أولًا / Set the manual USD rate first");
      payload.price = Math.round(Number(payload.price_usd) * rate * 1_000_000) / 1_000_000;
    }
    if (hasEgp && !hasUsd && rate > 0) {
      payload.price_usd = Math.round((Number(payload.price) / rate) * 1_000_000) / 1_000_000;
    }
    if (data.id) {
      const { error } = await supabaseAdmin.from("products").update(payload).eq("id", data.id);
      if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    } else {
      const { error } = await supabaseAdmin.from("products").insert(payload);
      if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    }
    return { ok: true };
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("products").delete().eq("id", data.id);
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    return { ok: true };
  });

// -------- Orders management --------
export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: "pending" | "completed" | "rejected" | "failed" } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let q = supabaseAdmin
      .from("orders")
      .select("id, user_id, product_id, product_title, amount, status, game_user_id, created_at")
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

export const decideOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["completed", "rejected"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // Atomic claim: only acts on pending orders to prevent double refunds.
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("orders")
      .update({ status: data.decision })
      .eq("id", data.id)
      .eq("status", "pending")
      .select("id, user_id, amount, product_title")
      .maybeSingle();
    if (claimError) { console.error("[db]", claimError); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    if (!claimed) throw new Error("الطلب غير موجود أو تمت معالجته مسبقًا");

    if (data.decision === "rejected") {
      // Atomic refund via SECURITY DEFINER function that locks the wallet row.
      const { error: e3 } = await supabaseAdmin.rpc("credit_wallet", {
        p_user_id: claimed.user_id,
        p_amount: Number(claimed.amount),
        p_type: "refund",
        p_description: `استرداد: ${claimed.product_title}`,
        p_ref_table: "orders",
        p_ref_id: claimed.id,
      });
      if (e3) {
        console.error("[decideOrder] credit_wallet", e3);
        throw new Error("تعذر استرداد الرصيد");
      }
    }

    notifyTelegram(
      data.decision === "completed"
        ? `✅ تم تنفيذ طلب: ${escapeTelegramHtml(claimed.product_title)} (EG ${escapeTelegramHtml(claimed.amount)})`
        : `❌ تم رفض الطلب: ${escapeTelegramHtml(claimed.product_title)} — تم إرجاع EG ${escapeTelegramHtml(claimed.amount)} للعميل`,
    ).catch(() => {});

    return { ok: true };
  });

// -------- Admin management (super admin only) --------
// Defense-in-depth: verify via both the DB security-definer `has_role` RPC
// (canonical role check) AND a direct row lookup. Both must agree.
async function assertSuperAdmin(userId: string) {
  if (!userId || typeof userId !== "string") {
    throw new Error("Forbidden: super admin only");
  }
  const [rpc, direct] = await Promise.all([
    supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
    supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle(),
  ]);
  if (rpc.error || direct.error) {
    console.error("[assertSuperAdmin]", rpc.error ?? direct.error);
    throw new Error("Forbidden: super admin only");
  }
  if (rpc.data !== true || !direct.data) {
    throw new Error("Forbidden: super admin only");
  }
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
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
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
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
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
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    return { ok: true };
  });

// -------- Users management --------
export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string } | undefined) =>
    z.object({ search: z.string().trim().max(120).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    let q = supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, email, custom_id, is_banned, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    const s = data.search?.replace(/[,()*:%_\\]/g, "").trim();
    if (s) q = q.or(`email.ilike.%${s}%,full_name.ilike.%${s}%,phone.ilike.%${s}%,custom_id.ilike.%${s}%`);
    const { data: profiles, error } = await q;
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); }
    const ids = (profiles ?? []).map((p) => p.id);
    const { data: wallets } = await supabaseAdmin
      .from("wallets")
      .select("user_id, balance")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const map = new Map((wallets ?? []).map((w) => [w.user_id, Number(w.balance)]));
    return (profiles ?? []).map((p) => ({ ...p, balance: map.get(p.id) ?? 0 }));
  });

export const adminSetUserBanned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), banned: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("لا تستطيع حظر نفسك");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_banned: data.banned })
      .eq("id", data.userId);
    if (error) { console.error("[adminSetUserBanned]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); }
    console.info("[adminSetUserBanned] actor=%s target=%s banned=%s", context.userId, data.userId, data.banned);
    return { ok: true };
  });

export const adminAdjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      mode: z.enum(["set", "add", "subtract"]),
      amount: z.number().finite().min(-10_000_000).max(10_000_000),
      note: z.string().trim().max(200).optional(),
    }).refine(
      (v) => v.mode === "set" || v.amount >= 0,
      { message: "amount must be non-negative for add/subtract", path: ["amount"] },
    ).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Super admin only — regular admins cannot modify balances
    await assertSuperAdmin(context.userId);

    // Confirm target user actually exists (defense in depth)
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target) throw new Error("المستخدم غير موجود");

    let delta = 0;
    let type = "adjustment";
    if (data.mode === "add") { delta = data.amount; type = "adjustment"; }
    else if (data.mode === "subtract") { delta = -data.amount; type = "adjustment"; }

    else {
      const { data: w } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", data.userId).maybeSingle();
      const current = Number(w?.balance ?? 0);
      delta = data.amount - current;
      type = "adjustment";
    }

    if (delta === 0) return { ok: true, balance: data.amount };

    // TOCTOU defense: re-verify super admin immediately before the privileged write.
    await assertSuperAdmin(context.userId);

    const safeNote = (data.note ?? "").replace(/[\r\n\t]+/g, " ").slice(0, 200);
    console.info("[adminAdjustBalance] actor=%s target=%s mode=%s amount=%s delta=%s",
      context.userId, data.userId, data.mode, data.amount, delta);
    const { data: newBalance, error } = await supabaseAdmin.rpc("credit_wallet", {
      p_user_id: data.userId,
      p_amount: delta,
      p_type: type,
      p_description: safeNote || (delta >= 0 ? "تعديل الرصيد بواسطة الأدمن" : "خصم بواسطة الأدمن"),
      p_ref_table: "admin_adjustment",
      p_ref_id: null as unknown as string,
    });
    if (error) { console.error("[adminAdjustBalance]", error); throw new Error("تعذر تعديل الرصيد"); }
    return { ok: true, balance: Number(newBalance) };
  });


// -------- Per-user product discounts (super admin only) --------
export const adminListDiscounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId?: string } | undefined) =>
    z.object({ userId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    let q = supabaseAdmin
      .from("user_discounts")
      .select("id, user_id, product_id, percent, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.userId) q = q.eq("user_id", data.userId);
    const { data: rows, error } = await q;
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); }
    const uids = [...new Set((rows ?? []).map((r) => r.user_id))];
    const pids = [...new Set((rows ?? []).map((r) => r.product_id))];
    const [profiles, products] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email, phone").in("id", uids.length ? uids : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("products").select("id, title, price").in("id", pids.length ? pids : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const pmap = new Map((profiles.data ?? []).map((p) => [p.id, p]));
    const prmap = new Map((products.data ?? []).map((p) => [p.id, p]));
    return (rows ?? []).map((r) => ({
      ...r,
      profile: pmap.get(r.user_id) ?? null,
      product: prmap.get(r.product_id) ?? null,
    }));
  });

export const adminUpsertDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      productId: z.string().uuid(),
      // Strict bounds; multipleOf snaps to DB numeric(5,2) precision so a
      // crafted client can't smuggle extra decimals or near-100 edge values.
      percent: z.number().finite().gt(0).max(100).multipleOf(0.01),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Layer 1: super-admin gate (DB RPC + direct row lookup must agree).
    await assertSuperAdmin(context.userId);

    // Layer 2: target existence checks — never trust client-supplied UUIDs.
    const [{ data: user }, { data: product }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id").eq("id", data.userId).maybeSingle(),
      supabaseAdmin.from("products").select("id").eq("id", data.productId).maybeSingle(),
    ]);
    if (!user) throw new Error("المستخدم غير موجود");
    if (!product) throw new Error("المنتج غير موجود");

    // Layer 3: normalize percent to DB precision (numeric(5,2)).
    const percent = Math.round(data.percent * 100) / 100;
    if (!(percent > 0 && percent <= 100)) throw new Error("نسبة غير صالحة");

    // Layer 4: TOCTOU defense — re-verify super admin immediately before write.
    await assertSuperAdmin(context.userId);

    console.info("[adminUpsertDiscount] actor=%s target=%s product=%s percent=%s",
      context.userId, data.userId, data.productId, percent);

    const { error } = await supabaseAdmin
      .from("user_discounts")
      .upsert(
        { user_id: data.userId, product_id: data.productId, percent, created_by: context.userId },
        { onConflict: "user_id,product_id" },
      );
    if (error) { console.error("[adminUpsertDiscount]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); }
    return { ok: true };
  });

export const adminDeleteDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    // Fetch the row first so we can log who/what was removed.
    const { data: row } = await supabaseAdmin
      .from("user_discounts")
      .select("id, user_id, product_id, percent")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("الخصم غير موجود");

    // TOCTOU recheck right before the privileged delete.
    await assertSuperAdmin(context.userId);

    console.info("[adminDeleteDiscount] actor=%s removed user=%s product=%s percent=%s",
      context.userId, row.user_id, row.product_id, row.percent);

    const { error } = await supabaseAdmin
      .from("user_discounts")
      .delete()
      .eq("id", data.id);
    if (error) { console.error("[adminDeleteDiscount]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); }
    return { ok: true };
  });

// -------- Provider auto-fulfillment (admin) --------
const providerEnum = z.enum(["brand1", "x3", "yassen", "sama", "wisam", "alshaikh"]);

export const adminBrand1TestConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { brand1Profile } = await import("./brand1.server");
    try {
      const profile = await brand1Profile();
      return { ok: true as const, profileJson: JSON.stringify(profile) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Unknown error" };
    }
  });

export const adminBrand1ListProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { brand1ListProducts } = await import("./brand1.server");
    try {
      const products = await brand1ListProducts();
      return {
        ok: true as const,
        products: products.map((p) => ({
          id: String(p.id),
          name: String(p.name ?? ""),
          price: p.price != null ? String(p.price) : "",
          categoryName: p.category_name ? String(p.category_name) : "",
        })),
      };
    } catch (e) {
      return { ok: false as const, products: [], error: e instanceof Error ? e.message : "Unknown error" };
    }
  });

export const adminX3TestConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { x3Profile } = await import("./x3.server");
    try {
      const profile = await x3Profile();
      return { ok: true as const, profileJson: JSON.stringify(profile) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Unknown error" };
    }
  });

export const adminX3ListProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { x3ListProducts } = await import("./x3.server");
    try {
      const products = await x3ListProducts();
      return {
        ok: true as const,
        products: products.map((p) => ({
          id: String(p.id),
          name: String(p.name ?? ""),
          price: p.price != null ? String(p.price) : "",
          categoryName: p.category_name ? String(p.category_name) : "",
        })),
      };
    } catch (e) {
      return { ok: false as const, products: [], error: e instanceof Error ? e.message : "Unknown error" };
    }
  });

export const adminYassenTestConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { yassenProfile } = await import("./yassen.server");
    try {
      const profile = await yassenProfile();
      return { ok: true as const, profileJson: JSON.stringify(profile) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Unknown error" };
    }
  });

export const adminYassenListProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { yassenListProducts } = await import("./yassen.server");
    try {
      const products = await yassenListProducts();
      return {
        ok: true as const,
        products: products.map((p) => ({
          id: String(p.id),
          name: String(p.name ?? ""),
          price: p.price != null ? String(p.price) : "",
          categoryName: p.category_name ? String(p.category_name) : "",
        })),
      };
    } catch (e) {
      return { ok: false as const, products: [], error: e instanceof Error ? e.message : "Unknown error" };
    }
  });

export const adminSamaTestConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { samaProfile } = await import("./sama.server");
    try {
      const profile = await samaProfile();
      return { ok: true as const, profileJson: JSON.stringify(profile) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Unknown error" };
    }
  });

export const adminSamaListProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { samaListProducts } = await import("./sama.server");
    try {
      const products = await samaListProducts();
      return {
        ok: true as const,
        products: products.map((p) => ({
          id: String(p.id),
          name: String(p.name ?? ""),
          price: p.price != null ? String(p.price) : "",
          categoryName: p.category_name ? String(p.category_name) : "",
        })),
      };
    } catch (e) {
      return { ok: false as const, products: [], error: e instanceof Error ? e.message : "Unknown error" };
    }
  });

export const adminWisamTestConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { wisamProfile } = await import("./wisam.server");
    try {
      const profile = await wisamProfile();
      return { ok: true as const, profileJson: JSON.stringify(profile) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Unknown error" };
    }
  });

export const adminWisamListProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { wisamListProducts } = await import("./wisam.server");
    try {
      const products = await wisamListProducts();
      return {
        ok: true as const,
        products: products.map((p) => ({
          id: String(p.id),
          name: String(p.name ?? ""),
          price: p.price != null ? String(p.price) : "",
          categoryName: p.category_name ? String(p.category_name) : "",
        })),
      };
    } catch (e) {
      return { ok: false as const, products: [], error: e instanceof Error ? e.message : "Unknown error" };
    }
  });

export const adminAlshaikhTestConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { alshaikhProfile } = await import("./alshaikh.server");
    try {
      const profile = await alshaikhProfile();
      return { ok: true as const, profileJson: JSON.stringify(profile) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Unknown error" };
    }
  });

export const adminAlshaikhListProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { alshaikhListProducts } = await import("./alshaikh.server");
    try {
      const products = await alshaikhListProducts();
      return {
        ok: true as const,
        products: products.map((p) => ({
          id: String(p.id),
          name: String(p.name ?? ""),
          price: p.price != null ? String(p.price) : "",
          categoryName: p.category_name ? String(p.category_name) : "",
        })),
      };
    } catch (e) {
      return { ok: false as const, products: [], error: e instanceof Error ? e.message : "Unknown error" };
    }
  });

export const adminSetProductProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      productId: z.string().uuid(),
      provider: providerEnum.nullable(),
      providerProductId: z.string().trim().max(120).nullable(),
      autoFulfillEnabled: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.autoFulfillEnabled && (!data.provider || !data.providerProductId)) {
      throw new Error("لتفعيل التنفيذ التلقائي، اختر المزود ورقم المنتج لديه");
    }

    const updates: {
      provider: "brand1" | "x3" | "yassen" | "sama" | "wisam" | "alshaikh" | null;
      provider_product_id: string | null;
      auto_fulfill_enabled: boolean;
      min_quantity?: number;
      max_quantity?: number;
    } = {
      provider: data.provider,
      provider_product_id: data.providerProductId,
      auto_fulfill_enabled: data.autoFulfillEnabled,
    };
    // Only pull qty limits from the provider when the product has none set yet —
    // never overwrite limits the admin entered manually.
    const { data: existing } = await supabaseAdmin
      .from("products")
      .select("min_quantity, max_quantity")
      .eq("id", data.productId)
      .maybeSingle();
    const hasManualLimits = existing?.min_quantity != null || existing?.max_quantity != null;
    if (data.provider && data.providerProductId && !hasManualLimits) {
      try {
        if (data.provider === "brand1") {
          const { brand1GetProduct } = await import("./brand1.server");
          const p = await brand1GetProduct(data.providerProductId);
          if (p?.qty_min != null) updates.min_quantity = p.qty_min;
          if (p?.qty_max != null) updates.max_quantity = p.qty_max;
        } else if (data.provider === "x3") {
          const { x3GetProduct } = await import("./x3.server");
          const p = await x3GetProduct(data.providerProductId);
          if (p?.qty_min != null) updates.min_quantity = p.qty_min;
          if (p?.qty_max != null) updates.max_quantity = p.qty_max;
        } else if (data.provider === "sama") {
          const { samaGetProduct } = await import("./sama.server");
          const p = await samaGetProduct(data.providerProductId);
          if (p?.qty_min != null) updates.min_quantity = p.qty_min;
          if (p?.qty_max != null) updates.max_quantity = p.qty_max;
        } else if (data.provider === "wisam") {
          const { wisamGetProduct } = await import("./wisam.server");
          const p = await wisamGetProduct(data.providerProductId);
          if (p?.qty_min != null) updates.min_quantity = p.qty_min;
          if (p?.qty_max != null) updates.max_quantity = p.qty_max;
        } else if (data.provider === "alshaikh") {
          const { alshaikhGetProduct } = await import("./alshaikh.server");
          const p = await alshaikhGetProduct(data.providerProductId);
          if (p?.qty_min != null) updates.min_quantity = p.qty_min;
          if (p?.qty_max != null) updates.max_quantity = p.qty_max;
        } else if (data.provider === "yassen") {
          const { yassenGetProduct } = await import("./yassen.server");
          const p = await yassenGetProduct(data.providerProductId);
          if (p?.qty_min != null) updates.min_quantity = p.qty_min;
          if (p?.qty_max != null) updates.max_quantity = p.qty_max;
        }
      } catch (e) {
        console.error("[adminSetProductProvider] qty sync failed", e);
      }
    }

    const { error } = await supabaseAdmin
      .from("products")
      .update(updates)
      .eq("id", data.productId);
    if (error) { console.error("[adminSetProductProvider]", error); throw new Error("حدث خطأ"); }
    return { ok: true };
  });

// -------- USD exchange rate (manual, super admin only) --------
const DEFAULT_USD_RATE = 50;

export const getUsdRate = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("site_settings").select("value").eq("key", "usd_rate").maybeSingle();
  const raw = (data?.value as { rate?: number; updated_at?: string } | null) ?? null;
  const rate = raw && typeof raw.rate === "number" && raw.rate > 0 ? raw.rate : DEFAULT_USD_RATE;
  return { rate, updated_at: raw?.updated_at ?? null };
});

export const adminUpdateUsdRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ rate: z.number().positive().max(100000) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const value = { rate: data.rate, updated_at: new Date().toISOString() };
    const { error } = await supabaseAdmin
      .from("site_settings").upsert({ key: "usd_rate", value }, { onConflict: "key" });
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); }
    return { ok: true, ...value };
  });





