import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { CheckCircle2, Clock, XCircle, PackageX } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyOrders } from "@/lib/shop.functions";
import { useEffect } from "react";

export const Route = createFileRoute("/transactions")({
  head: () => ({ meta: [{ title: "المعاملات — Lion Store" }] }),
  component: Transactions,
});

const statusMap = {
  completed: { label: "مكتمل", icon: CheckCircle2, color: "text-emerald-400" },
  pending: { label: "قيد التنفيذ", icon: Clock, color: "text-gold" },
  rejected: { label: "مرفوض", icon: XCircle, color: "text-destructive" },
  failed: { label: "فاشل", icon: XCircle, color: "text-destructive" },
} as const;

function Transactions() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchOrders = useServerFn(listMyOrders);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  const orders = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: () => fetchOrders(),
    enabled: !!user,
  });

  if (loading || !user) {
    return (
      <AppLayout>
        <div className="min-h-[40vh] grid place-items-center text-muted-foreground">جاري التحقق من الجلسة...</div>
      </AppLayout>
    );
  }

  const list = orders.data ?? [];

  return (
    <AppLayout>
      <h1 className="text-3xl font-black text-gold-gradient mb-6">المعاملات</h1>
      {orders.isLoading ? (
        <div className="p-10 text-center text-muted-foreground">جاري التحميل...</div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/70 p-10 text-center">
          <PackageX className="mx-auto size-12 text-muted-foreground mb-3" />
          <p className="font-bold">لا توجد معاملات بعد</p>
          <p className="text-sm text-muted-foreground mt-1">طلباتك ومشترياتك هتظهر هنا</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card/70">
          {list.map((t, i) => {
            const s = statusMap[t.status as keyof typeof statusMap] ?? statusMap.pending;
            return (
              <div key={t.id} className={`flex items-center justify-between gap-3 p-4 ${i ? "border-t border-border" : ""}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <s.icon className={`size-6 shrink-0 ${s.color}`} />
                  <div className="min-w-0">
                    <p className="font-extrabold truncate">{t.product_title}</p>
                    <p dir="ltr" className="text-xs text-muted-foreground text-right">
                      #{String(t.id).slice(0, 8)} • {new Date(t.created_at).toLocaleDateString("ar-EG")}
                      {t.game_user_id ? ` • ID: ${t.game_user_id}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <p dir="ltr" className="font-black text-gold-gradient">EG {Number(t.amount).toLocaleString()}</p>
                  <p className={`text-xs ${s.color}`}>{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
