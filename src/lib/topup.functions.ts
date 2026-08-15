import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyTelegram, escapeTelegramHtml } from "./telegram.server";
import { enforceRateLimit } from "./rate-limit.server";

// -------- Payment methods (super admin editable) --------
export type PaymentMethods = {
  vodafone_cash: string;
  instapay_account: string;
  instapay_link: string;
  binance: string;
  vodafone_cash_enabled: boolean;
  instapay_enabled: boolean;
  binance_enabled: boolean;
};

const DEFAULT_PAYMENT_METHODS: PaymentMethods = {
  vodafone_cash: "01040483540",
  instapay_account: "islam20304050@instapay",
  instapay_link: "https://ipn.eg/S/islam20304050/instapay/7sbSIb",
  binance: "TS3NudYfcXA3cUBqZmMUFPpidZRdFG86PD",
  vodafone_cash_enabled: true,
  instapay_enabled: true,
  binance_enabled: true,
};

export const getPaymentMethods = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin.from("site_settings").select("value").eq("key", "payment_methods").maybeSingle();
  return { ...DEFAULT_PAYMENT_METHODS, ...((data?.value ?? {}) as Partial<PaymentMethods>) } as PaymentMethods;
});

const paymentMethodsSchema = z.object({
  vodafone_cash: z.string().trim().max(200),
  instapay_account: z.string().trim().max(200),
  instapay_link: z.string().trim().max(500),
  binance: z.string().trim().max(200),
  vodafone_cash_enabled: z.boolean(),
  instapay_enabled: z.boolean(),
  binance_enabled: z.boolean(),
});

export const adminUpdatePaymentMethods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => paymentMethodsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "super_admin");
    if (!roles || roles.length === 0) throw new Error("Forbidden: super admin only");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: "payment_methods", value: data }, { onConflict: "key" });
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); }
    return { ok: true };
  });



const createSchema = z.object({
  amount: z.number().positive().max(1_000_000),
  method: z.enum(["vodafone_cash", "instapay", "fawry", "binance"]),
  reference: z.string().trim().min(3).max(200),
  note: z.string().trim().max(500).optional(),
  screenshot_path: z.string().trim().max(500).optional(),
}).refine(
  (d) => (d.method === "binance" ? d.amount >= 50 : d.amount >= 100),
  { message: "الحد الأدنى للشحن غير مستوفى", path: ["amount"] },
);

export const createTopupRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Reject if this payment method is currently under maintenance
    const { data: pmRow } = await supabaseAdmin.from("site_settings").select("value").eq("key", "payment_methods").maybeSingle();
    const pm = { ...DEFAULT_PAYMENT_METHODS, ...((pmRow?.value ?? {}) as Partial<PaymentMethods>) };
    const enabledKey = data.method === "vodafone_cash" ? "vodafone_cash_enabled"
      : data.method === "instapay" ? "instapay_enabled"
      : data.method === "binance" ? "binance_enabled" : null;
    if (enabledKey && !pm[enabledKey]) {
      throw new Error("وسيلة الدفع هذه تحت الصيانة حاليًا، اختر طريقة أخرى");
    }

    // Enforce that the receipt path belongs to the caller (prevents IDOR on other users' uploads)
    if (data.screenshot_path && !data.screenshot_path.startsWith(`${userId}/`)) {
      throw new Error("Invalid screenshot path");
    }

    // Anti-spam only (no daily cap): max 5 requests per minute
    await enforceRateLimit(`topup:${userId}`, 5, 60, "طلبات كثيرة في وقت قصير، انتظر دقيقة ثم حاول مرة أخرى");

    const refTrimmed = data.reference.trim();

    // Idempotency: block the same deposit being submitted twice within 60s
    const { claimRequestLock } = await import("@/lib/request-lock.server");
    await claimRequestLock(
      `topup:${userId}:${data.method}:${data.amount}:${refTrimmed.toLowerCase()}`,
      60,
      "تم إرسال طلب الشحن بالفعل، انتظر قليلاً قبل المحاولة مرة أخرى",
    );

    // Block duplicate reference numbers globally
    const { data: existing } = await supabase
      .from("topup_requests")
      .select("id")
      .eq("reference", refTrimmed)
      .limit(1)
      .maybeSingle();
    if (existing) {
      throw new Error("هذا الرقم المرجعي مستخدم من قبل");
    }


    const { data: row, error } = await supabase
      .from("topup_requests")
      .insert({
        user_id: userId,
        amount: data.amount,
        method: data.method,
        reference: refTrimmed,
        note: data.note ?? null,
        screenshot_path: data.screenshot_path ?? null,
      })
      .select("id, amount, method, reference, created_at")
      .single();

    if (error) {
      console.error("[db]", error);
      if ((error as { code?: string }).code === "23505") {
        throw new Error("هذا الرقم المرجعي مستخدم من قبل");
      }
      throw new Error("حدث خطأ، حاول مرة أخرى");
    }

    // Telegram notification (with screenshot if provided)
    const { data: profile } = await supabase.from("profiles").select("full_name, phone, custom_id").eq("id", userId).maybeSingle();
    const caption =
      `🔔 <b>طلب شحن جديد</b>\n` +
      `🆔 ${escapeTelegramHtml(profile?.custom_id ?? "—")}\n` +
      `👤 ${escapeTelegramHtml(profile?.full_name || "بدون اسم")} (${escapeTelegramHtml(profile?.phone || "—")})\n` +
      `💰 المبلغ: <b>${escapeTelegramHtml(data.amount)} EGP</b>\n` +
      `💳 الطريقة: ${escapeTelegramHtml(data.method)}\n` +
      `🔖 المرجع: ${escapeTelegramHtml(data.reference)}`;

    if (data.screenshot_path) {
      try {
        const { data: signed } = await supabaseAdmin.storage
          .from("topup-receipts")
          .createSignedUrl(data.screenshot_path, 60 * 60);
        if (signed?.signedUrl) {
          const { notifyTelegramPhoto } = await import("./telegram.server");
          await notifyTelegramPhoto(signed.signedUrl, caption);
        } else {
          await notifyTelegram(caption);
        }
      } catch (e) {
        console.error("topup screenshot notify failed", e);
        await notifyTelegram(caption).catch((err) => console.error("topup telegram fallback failed", err));
      }
    } else {
      await notifyTelegram(caption).catch((err) => console.error("topup telegram notify failed", err));
    }

    return { ok: true, id: row.id };
  });

export const listMyTopups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("topup_requests")
      .select("id, amount, method, reference, status, created_at, admin_note")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });
