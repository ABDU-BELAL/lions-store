import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

export const Route = createFileRoute("/transactions")({
  head: () => ({ meta: [{ title: "المعاملات — Lion Store" }] }),
  component: Transactions,
});

const tx = [
  { id: "TX-10293", title: "660 UC ببجي موبايل", amount: "EG 199", status: "completed", date: "2026-05-30" },
  { id: "TX-10292", title: "اشتراك نتفليكس شهر", amount: "EG 165", status: "completed", date: "2026-05-28" },
  { id: "TX-10288", title: "100 جوهرة فري فاير", amount: "EG 45", status: "pending", date: "2026-05-26" },
  { id: "TX-10280", title: "بطاقة ستيم 20$", amount: "EG 720", status: "failed", date: "2026-05-22" },
];

const statusMap = {
  completed: { label: "مكتمل", icon: CheckCircle2, color: "text-emerald-400" },
  pending: { label: "قيد التنفيذ", icon: Clock, color: "text-gold" },
  failed: { label: "فاشل", icon: XCircle, color: "text-destructive" },
} as const;

function Transactions() {
  return (
    <AppLayout>
      <h1 className="text-3xl font-black text-gold-gradient mb-6">المعاملات</h1>
      <div className="overflow-hidden rounded-2xl border border-border bg-card/70">
        {tx.map((t, i) => {
          const s = statusMap[t.status as keyof typeof statusMap];
          return (
            <div key={t.id} className={`flex items-center justify-between gap-3 p-4 ${i ? "border-t border-border" : ""}`}>
              <div className="flex items-center gap-3 min-w-0">
                <s.icon className={`size-6 shrink-0 ${s.color}`} />
                <div className="min-w-0">
                  <p className="font-extrabold truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.id} • {t.date}</p>
                </div>
              </div>
              <div className="text-left shrink-0">
                <p className="font-black text-gold-gradient">{t.amount}</p>
                <p className={`text-xs ${s.color}`}>{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
