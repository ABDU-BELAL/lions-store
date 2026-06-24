import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface UserNotification {
  id: string;
  type: "order" | "topup";
  title: string;
  description: string;
  status: string;
  created_at: string;
  amount?: number;
}

export const getMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [ordersRes, topupsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, product_title, amount, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("topup_requests")
        .select("id, amount, method, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const orders: UserNotification[] = (ordersRes.data ?? []).map((o) => ({
      id: `order-${o.id}`,
      type: "order",
      title: `طلب: ${o.product_title}`,
      description: statusLabel(o.status, "order"),
      status: o.status,
      created_at: o.created_at,
      amount: Number(o.amount),
    }));

    const topups: UserNotification[] = (topupsRes.data ?? []).map((t) => ({
      id: `topup-${t.id}`,
      type: "topup",
      title: `طلب شحن بقيمة ${Number(t.amount).toLocaleString()} EGP`,
      description: statusLabel(t.status, "topup"),
      status: t.status,
      created_at: t.created_at,
      amount: Number(t.amount),
    }));

    return [...orders, ...topups].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  });

function statusLabel(status: string, type: "order" | "topup") {
  if (type === "order") {
    if (status === "pending") return "قيد التنفيذ";
    if (status === "completed") return "تم التنفيذ بنجاح";
    if (status === "rejected") return "تم الرفض واسترداد المبلغ";
    return status;
  }
  if (status === "pending") return "قيد المراجعة";
  if (status === "approved") return "تم قبول الشحن";
  if (status === "rejected") return "تم رفض الشحن";
  return status;
}
