import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notifyTelegram } from "./telegram.server";

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

    const { data: row, error } = await supabase
      .from("topup_requests")
      .insert({
        user_id: userId,
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        note: data.note ?? null,
      })
      .select("id, amount, method, reference, created_at")
      .single();

    if (error) throw new Error(error.message);

    // Best-effort Telegram notification
    const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle();
    notifyTelegram(
      `🔔 <b>طلب شحن جديد</b>\n` +
      `👤 ${profile?.full_name || "بدون اسم"} (${profile?.phone || "—"})\n` +
      `💰 المبلغ: <b>${data.amount} EGP</b>\n` +
      `💳 الطريقة: ${data.method}\n` +
      `🔖 المرجع: ${data.reference}`,
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
