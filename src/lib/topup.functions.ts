import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notifyTelegram, escapeTelegramHtml } from "./telegram.server";
import { enforceRateLimit } from "./rate-limit.server";

const createSchema = z.object({
  amount: z.number().positive().max(1_000_000),
  method: z.enum(["vodafone_cash", "instapay", "fawry", "binance"]),
  reference: z.string().trim().min(3).max(200),
  note: z.string().trim().max(500).optional(),
});

export const createTopupRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Rate limit: max 5 topup requests per user per hour
    await enforceRateLimit(`topup:${userId}`, 5, 3600, "لقد تجاوزت الحد المسموح به، يرجى المحاولة لاحقاً");

    // Block duplicate reference numbers globally
    const refTrimmed = data.reference.trim();
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
      })
      .select("id, amount, method, reference, created_at")
      .single();

    if (error) {
      console.error("[db]", error);
      // 23505 = unique_violation (race with another insert hitting the unique index)
      if ((error as { code?: string }).code === "23505") {
        throw new Error("هذا الرقم المرجعي مستخدم من قبل");
      }
      throw new Error("حدث خطأ، حاول مرة أخرى");
    }

    // Best-effort Telegram notification
    const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle();
    notifyTelegram(
      `🔔 <b>طلب شحن جديد</b>\n` +
      `👤 ${escapeTelegramHtml(profile?.full_name || "بدون اسم")} (${escapeTelegramHtml(profile?.phone || "—")})\n` +
      `💰 المبلغ: <b>${escapeTelegramHtml(data.amount)} EGP</b>\n` +
      `💳 الطريقة: ${escapeTelegramHtml(data.method)}\n` +
      `🔖 المرجع: ${escapeTelegramHtml(data.reference)}`,
    ).catch(() => {});

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
