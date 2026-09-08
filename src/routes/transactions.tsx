import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { CheckCircle2, Clock, XCircle, PackageX, ArrowDownCircle, ArrowUpCircle, RefreshCcw, Wallet, X, Copy, Check } from "lucide-react";
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

type OrderRow = {
  id: string;
  product_title: string;
  amount: number | string;
  status: string;
  game_user_id: string | null;
  quantity?: number | null;
  created_at: string;
};

type TxnRow = {
  id: string;
  type: string;
  amount: number | string;
  balance_after: number | string;
  description: string | null;
  created_at: string;
};

const statusMap = {
  completed: { labelAr: "مكتمل", labelEn: "Completed", icon: CheckCircle2, color: "text-emerald-400" },
  pending: { labelAr: "قيد التنفيذ", labelEn: "Pending", icon: Clock, color: "text-gold" },
  rejected: { labelAr: "مرفوض", labelEn: "Rejected", icon: XCircle, color: "text-destructive" },
  failed: { labelAr: "فاشل", labelEn: "Failed", icon: XCircle, color: "text-destructive" },
} as const;

const txnMeta = {
  deposit: { labelAr: "إيداع", labelEn: "Deposit", icon: ArrowDownCircle, color: "text-emerald-400" },
  refund: { labelAr: "استرداد", labelEn: "Refund", icon: RefreshCcw, color: "text-sky-400" },
  purchase: { labelAr: "شراء", labelEn: "Purchase", icon: ArrowUpCircle, color: "text-destructive" },
  adjustment: { labelAr: "تعديل", labelEn: "Adjustment", icon: Wallet, color: "text-gold" },
} as const;

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary/70 hover:text-foreground transition-colors"
      aria-label="Copy"
    >
      {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
    </button>
  );
}

function ReceiptRow({ label, value, copy, dir }: { label: string; value: React.ReactNode; copy?: string; dir?: "ltr" }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border/60 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="flex items-center gap-1 min-w-0 text-sm font-bold text-left" dir={dir}>
        <span className="truncate">{value}</span>
        {copy ? <CopyButton value={copy} /> : null}
      </span>
    </div>
  );
}

function Transactions() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchOrders = useServerFn(listMyOrders);
  const fetchTxns = useServerFn(listMyWalletTxns);
  const [tab, setTab] = useState<"orders" | "wallet">("orders");
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<TxnRow | null>(null);
  const { t, lang } = useLang();
  const { format } = useCurrency();

  useEffect(() => { if (!loading && !user) navigate({ to: "/login", replace: true }); }, [loading, user, navigate]);

  const orders = useQuery({ queryKey: ["my-orders", user?.id], queryFn: () => fetchOrders(), enabled: !!user });
  const txns = useQuery({ queryKey: ["my-wallet-txns", user?.id], queryFn: () => fetchTxns(), enabled: !!user });

  const orderList = (orders.data ?? []) as OrderRow[];
  const txnList = (txns.data ?? []) as TxnRow[];

  const locale = lang === "en" ? "en-US" : "ar-EG";

  const selectedStatus = selectedOrder
    ? (statusMap[selectedOrder.status as keyof typeof statusMap] ?? statusMap.pending)
    : null;
  const selectedTxnMeta = selectedTxn
    ? (txnMeta[selectedTxn.type as keyof typeof txnMeta] ?? txnMeta.adjustment)
    : null;

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
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedOrder(row)}
                  className={`w-full flex items-center justify-between gap-3 p-4 text-start hover:bg-secondary/40 active:bg-secondary/60 transition-colors cursor-pointer ${i ? "border-t border-border" : ""}`}
                >
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
                  <div className="shrink-0 text-end">
                    <p dir="ltr" className="font-black text-gold-gradient">{format(Number(row.amount))}</p>
                    <p className={`text-xs ${s.color}`}>{t(s.labelAr, s.labelEn)}</p>
                  </div>
                </button>
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
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedTxn(row)}
                className={`w-full flex items-center justify-between gap-3 p-4 text-start hover:bg-secondary/40 active:bg-secondary/60 transition-colors cursor-pointer ${i ? "border-t border-border" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <m.icon className={`size-6 shrink-0 ${m.color}`} />
                  <div className="min-w-0">
                    <p className="font-extrabold truncate">{row.description ?? t(m.labelAr, m.labelEn)}</p>
                    <p dir="ltr" className="text-xs text-muted-foreground">
                      {t(m.labelAr, m.labelEn)} • {new Date(row.created_at).toLocaleString(locale)}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-end">
                  <p dir="ltr" className={`font-black ${isNegative ? "text-destructive" : "text-emerald-400"}`}>
                    {isNegative ? "" : "+"}{format(Number(row.amount))}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{t("رصيد:", "Balance:")} {format(Number(row.balance_after))}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Order receipt modal */}
      {selectedOrder && selectedStatus && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <selectedStatus.icon className={`size-8 ${selectedStatus.color}`} />
                <div>
                  <h2 className="text-lg font-black">{t("إيصال الطلب", "Order receipt")}</h2>
                  <p className={`text-xs font-bold ${selectedStatus.color}`}>{t(selectedStatus.labelAr, selectedStatus.labelEn)}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} className="rounded-full p-2 hover:bg-secondary/70" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>

            <div className="rounded-2xl bg-secondary/30 px-4">
              <ReceiptRow label={t("المنتج", "Item")} value={selectedOrder.product_title} />
              <ReceiptRow
                label={t("رقم الطلب", "Order ID")}
                value={<span className="font-mono text-xs">#{selectedOrder.id.slice(0, 8)}</span>}
                copy={selectedOrder.id}
                dir="ltr"
              />
              <ReceiptRow
                label={t("التاريخ والوقت", "Date & time")}
                value={new Date(selectedOrder.created_at).toLocaleString(locale)}
                dir="ltr"
              />
              <ReceiptRow
                label={t("المبلغ المدفوع", "Price paid")}
                value={<span className="text-gold-gradient font-black">{format(Number(selectedOrder.amount))}</span>}
                dir="ltr"
              />
              {selectedOrder.quantity != null && (
                <ReceiptRow label={t("الكمية", "Quantity")} value={selectedOrder.quantity} dir="ltr" />
              )}
              {selectedOrder.game_user_id && (
                <ReceiptRow
                  label={t("آيدي اللاعب / الحساب", "Game / account ID")}
                  value={<span className="font-mono text-xs">{selectedOrder.game_user_id}</span>}
                  copy={selectedOrder.game_user_id}
                  dir="ltr"
                />
              )}
              <ReceiptRow
                label={t("الحالة", "Status")}
                value={<span className={selectedStatus.color}>{t(selectedStatus.labelAr, selectedStatus.labelEn)}</span>}
              />
            </div>

            <button
              type="button"
              onClick={() => setSelectedOrder(null)}
              className="mt-5 w-full rounded-xl bg-gold-gradient py-3 font-black text-primary-foreground shadow-gold"
            >
              {t("إغلاق", "Close")}
            </button>
          </div>
        </div>
      )}

      {/* Wallet transaction receipt modal */}
      {selectedTxn && selectedTxnMeta && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedTxn(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <selectedTxnMeta.icon className={`size-8 ${selectedTxnMeta.color}`} />
                <div>
                  <h2 className="text-lg font-black">{t("إيصال المحفظة", "Wallet receipt")}</h2>
                  <p className={`text-xs font-bold ${selectedTxnMeta.color}`}>{t(selectedTxnMeta.labelAr, selectedTxnMeta.labelEn)}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedTxn(null)} className="rounded-full p-2 hover:bg-secondary/70" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>

            <div className="rounded-2xl bg-secondary/30 px-4">
              <ReceiptRow
                label={t("البيان", "Item")}
                value={selectedTxn.description ?? t(selectedTxnMeta.labelAr, selectedTxnMeta.labelEn)}
              />
              <ReceiptRow
                label={t("رقم العملية", "Transaction ID")}
                value={<span className="font-mono text-xs">#{selectedTxn.id.slice(0, 8)}</span>}
                copy={selectedTxn.id}
                dir="ltr"
              />
              <ReceiptRow
                label={t("التاريخ والوقت", "Date & time")}
                value={new Date(selectedTxn.created_at).toLocaleString(locale)}
                dir="ltr"
              />
              <ReceiptRow
                label={t("المبلغ", "Amount")}
                value={
                  <span className={`font-black ${Number(selectedTxn.amount) < 0 ? "text-destructive" : "text-emerald-400"}`}>
                    {Number(selectedTxn.amount) < 0 ? "" : "+"}{format(Number(selectedTxn.amount))}
                  </span>
                }
                dir="ltr"
              />
              <ReceiptRow
                label={t("الرصيد بعد العملية", "Balance after")}
                value={format(Number(selectedTxn.balance_after))}
                dir="ltr"
              />
              <ReceiptRow
                label={t("النوع", "Type")}
                value={<span className={selectedTxnMeta.color}>{t(selectedTxnMeta.labelAr, selectedTxnMeta.labelEn)}</span>}
              />
            </div>

            <button
              type="button"
              onClick={() => setSelectedTxn(null)}
              className="mt-5 w-full rounded-xl bg-gold-gradient py-3 font-black text-primary-foreground shadow-gold"
            >
              {t("إغلاق", "Close")}
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
