import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { CheckCircle2, Clock, XCircle, PackageX, ArrowDownCircle, ArrowUpCircle, RefreshCcw, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyOrders } from "@/lib/shop.functions";
import { listMyWalletTxns } from "@/lib/wallet.functions";
import { useEffect, useState } from "react";
import { useLang } from "@/i18n/LanguageProvider";
import { useCurrency } from "@/i18n/CurrencyProvider";

void Link;

export const Route = createFileRoute("/transactions")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Transactions — Lion Store / المعاملات" },
      { name: "description", content: "View your top-up and wallet history." },
      { property: "og:url", content: "https://lions-stores.com/transactions" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://lions-stores.com/transactions" }],
  }),
  beforeLoad: async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const { redirect } = await import("@tanstack/react-router");
      throw redirect({ to: "/login" });
    }
  },
  component: Transactions,
});

function Transactions() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchOrders = useServerFn(listMyOrders);
  const fetchTxns = useServerFn(listMyWalletTxns);
  const [tab, setTab] = useState<"orders" | "wallet">("orders");
  const { t, lang } = useLang();
  const { format } = useCurrency();

  useEffect(() => { if (!loading && !user) navigate({ to: "/login", replace: true }); }, [loading, user, navigate]);

  const orders = useQuery({ queryKey: ["my-orders", user?.id], queryFn: () => fetchOrders(), enabled: !!user });
  const txns = useQuery({ queryKey: ["my-wallet-txns", user?.id], queryFn: () => fetchTxns(), enabled: !!user });

  const orderList = orders.data ?? [];
  const txnList = txns.data ?? [];

  const statusMap = {
    completed: { label: t("مكتمل", "Completed"), icon: CheckCircle2, color: "text-emerald-400" },
    pending: { label: t("قيد التنفيذ", "Pending"), icon: Clock, color: "text-gold" },
    rejected: { label: t("مرفوض", "Rejected"), icon: XCircle, color: "text-destructive" },
    failed: { label: t("فاشل", "Failed"), icon: XCircle, color: "text-destructive" },
  } as const;

  const txnMeta = {
    deposit: { label: t("إيداع", "Deposit"), icon: ArrowDownCircle, color: "text-emerald-400" },
    refund: { label: t("استرداد", "Refund"), icon: RefreshCcw, color: "text-sky-400" },
    purchase: { label: t("شراء", "Purchase"), icon: ArrowUpCircle, color: "text-destructive" },
    adjustment: { label: t("تعديل", "Adjustment"), icon: Wallet, color: "text-gold" },
  } as const;
  const locale = lang === "en" ? "en-US" : "ar-EG";

  return (
    <AppLayout>
      <h1 className="text-3xl font-black text-gold-gradient mb-6">{t("المعاملات", "Transactions")}</h1>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("orders")} className={`px-4 py-2 rounded-xl font-bold text-sm ${tab === "orders" ? "bg-gold-gradient text-primary-foreground shadow-gold" : "bg-secondary/60"}`}>
          {t("الطلبات", "Orders")}
        </button>
        <button onClick={() => setTab("wallet")} className={`px-4 py-2 rounded-xl font-bold text-sm ${tab === "wallet" ? "bg-gold-gradient text-primary-foreground shadow-gold" : "bg-secondary/60"}`}>
          {t("سجل المحفظة", "Wallet history")}
        </button>
      </div>

      {tab === "orders" ? (
        orders.isLoading ? (
          <div className="p-10 text-center text-muted-foreground">{t("جاري التحميل...", "Loading...")}</div>
        ) : orderList.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/70 p-10 text-center">
            <PackageX className="mx-auto size-12 text-muted-foreground mb-3" />
            <p className="font-bold">{t("لا توجد طلبات بعد", "No orders yet")}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card/70">
            {orderList.map((row, i) => {
              const s = statusMap[row.status as keyof typeof statusMap] ?? statusMap.pending;
              return (
                <div key={row.id} className={`flex items-center justify-between gap-3 p-4 ${i ? "border-t border-border" : ""}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <s.icon className={`size-6 shrink-0 ${s.color}`} />
                    <div className="min-w-0">
                      <p className="font-extrabold truncate">{row.product_title}</p>
                      <p dir="ltr" className="text-xs text-muted-foreground">
                        #{String(row.id).slice(0, 8)} • {new Date(row.created_at).toLocaleDateString(locale)}
                        {row.game_user_id ? ` • ID: ${row.game_user_id}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <p dir="ltr" className="font-black text-gold-gradient">{format(Number(row.amount))}</p>
                    <p className={`text-xs ${s.color}`}>{s.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : txns.isLoading ? (
        <div className="p-10 text-center text-muted-foreground">{t("جاري التحميل...", "Loading...")}</div>
      ) : txnList.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/70 p-10 text-center">
          <Wallet className="mx-auto size-12 text-muted-foreground mb-3" />
          <p className="font-bold">{t("لا توجد حركات على المحفظة بعد", "No wallet activity yet")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card/70">
          {txnList.map((row, i) => {
            const m = txnMeta[row.type as keyof typeof txnMeta] ?? txnMeta.adjustment;
            const isNegative = Number(row.amount) < 0;
            return (
              <div key={row.id} className={`flex items-center justify-between gap-3 p-4 ${i ? "border-t border-border" : ""}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <m.icon className={`size-6 shrink-0 ${m.color}`} />
                  <div className="min-w-0">
                    <p className="font-extrabold truncate">{row.description ?? m.label}</p>
                    <p dir="ltr" className="text-xs text-muted-foreground">
                      {m.label} • {new Date(row.created_at).toLocaleString(locale)}
                    </p>
                  </div>
                </div>
                <div className="shrink-0">
                  <p dir="ltr" className={`font-black ${isNegative ? "text-destructive" : "text-emerald-400"}`}>
                    {isNegative ? "" : "+"}{format(Number(row.amount))}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{t("رصيد:", "Balance:")} {format(Number(row.balance_after))}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
