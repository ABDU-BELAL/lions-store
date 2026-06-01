import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAccount } from "@/lib/account.functions";
import { createTopupRequest, listMyTopups } from "@/lib/topup.functions";
import { useState } from "react";
import { Wallet, Phone, Building2, Banknote, Bitcoin, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/topup")({
  head: () => ({ meta: [{ title: "شحن الرصيد — Lion Store" }] }),
  component: TopupPage,
});

const methods = [
  { id: "vodafone_cash", label: "فودافون كاش", icon: Phone, account: "01027923110", color: "bg-red-600" },
  { id: "instapay", label: "إنستا باي", account: "lionstore@instapay", icon: Building2, color: "bg-purple-600" },
  { id: "fawry", label: "فوري", account: "كود التاجر: 123456", icon: Banknote, color: "bg-orange-600" },
  { id: "binance", label: "Binance (USDT)", account: "TGn...Lion (TRC20)", icon: Bitcoin, color: "bg-yellow-500" },
] as const;

const statusMap = {
  pending: { label: "قيد المراجعة", icon: Clock, color: "text-gold" },
  approved: { label: "تم القبول", icon: CheckCircle2, color: "text-emerald-400" },
  rejected: { label: "مرفوض", icon: XCircle, color: "text-destructive" },
} as const;

function TopupPage() {
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const getAccount = useServerFn(getMyAccount);
  const createTopup = useServerFn(createTopupRequest);
  const myTopups = useServerFn(listMyTopups);

  const account = useQuery({ queryKey: ["account"], queryFn: () => getAccount(), enabled: !!user });
  const topups = useQuery({ queryKey: ["my-topups"], queryFn: () => myTopups(), enabled: !!user });

  const [method, setMethod] = useState<typeof methods[number]["id"]>("vodafone_cash");
  const [amount, setAmount] = useState<number>(100);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: (vars: { amount: number; method: typeof method; reference: string; note?: string }) =>
      createTopup({ data: vars }),
    onSuccess: () => {
      toast.success("تم إرسال طلب الشحن! هيتم مراجعته خلال دقائق.");
      setReference(""); setNote("");
      qc.invalidateQueries({ queryKey: ["my-topups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!authLoading && !user) {
    throw redirect({ to: "/login" });
  }

  const active = methods.find((m) => m.id === method)!;

  return (
    <AppLayout>
      {/* Balance */}
      <div className="rounded-3xl bg-dark-gradient border-gold shadow-card p-6 flex items-center gap-4">
        <div className="grid place-items-center size-14 rounded-2xl bg-gold-gradient text-primary-foreground"><Wallet className="size-7" /></div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">رصيدك الحالي</p>
          <p className="text-3xl font-black text-gold-gradient">EG {Number(account.data?.balance ?? 0).toLocaleString()}</p>
        </div>
      </div>

      <h1 className="mt-6 text-2xl md:text-3xl font-black text-gold-gradient">شحن الرصيد</h1>
      <p className="text-muted-foreground text-sm mt-1">اختار طريقة الدفع، حوّل المبلغ، وارفع لنا رقم العملية. هنراجع الطلب يدويًا وننزّل الرصيد على محفظتك.</p>

      {/* Method picker */}
      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        {methods.map((m) => (
          <button key={m.id} onClick={() => setMethod(m.id)} className={`p-4 rounded-2xl border text-right transition ${method === m.id ? "border-gold/70 bg-gradient-to-b from-gold/20 to-card shadow-gold" : "border-border bg-card/70 hover:border-gold/40"}`}>
            <div className={`grid place-items-center size-10 rounded-xl ${m.color} text-white mb-2`}><m.icon className="size-5" /></div>
            <p className="font-extrabold text-sm">{m.label}</p>
          </button>
        ))}
      </div>

      {/* Instructions */}
      <div className="mt-4 rounded-2xl border border-gold/40 bg-card/70 p-4">
        <p className="text-sm">حوّل المبلغ على <span className="font-extrabold text-gold-gradient">{active.label}</span>:</p>
        <p dir="ltr" className="mt-1 text-lg font-black text-gold-gradient text-right">{active.account}</p>
        <p className="text-xs text-muted-foreground mt-1">بعد التحويل، اكتب رقم العملية تحت وابعت الطلب.</p>
      </div>

      {/* Form */}
      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate({ amount, method, reference, note: note || undefined }); }}
        className="mt-4 rounded-2xl bg-card/70 border border-border p-5 space-y-3"
      >
        <div>
          <label className="text-xs font-bold mb-1 block">المبلغ (EGP)</label>
          <input type="number" min={10} max={1000000} required value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold/50" />
        </div>
        <div>
          <label className="text-xs font-bold mb-1 block">رقم العملية / المرجع</label>
          <input required minLength={3} maxLength={200} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="مثلاً: TXN12345 أو 4 أرقام أخيرة من رقم المحول منه" className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold/50" />
        </div>
        <div>
          <label className="text-xs font-bold mb-1 block">ملاحظات (اختياري)</label>
          <textarea maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold/50 resize-none" />
        </div>
        <button disabled={mutation.isPending} className="w-full rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold disabled:opacity-50">
          {mutation.isPending ? "جاري الإرسال..." : "إرسال طلب الشحن"}
        </button>
      </form>

      {/* History */}
      <h2 className="mt-8 text-xl font-extrabold text-gold-gradient">سجل طلبات الشحن</h2>
      <div className="mt-3 rounded-2xl overflow-hidden border border-border bg-card/70">
        {(topups.data ?? []).length === 0 && <p className="p-6 text-center text-muted-foreground text-sm">لا توجد طلبات بعد</p>}
        {(topups.data ?? []).map((t, i) => {
          const s = statusMap[t.status as keyof typeof statusMap];
          return (
            <div key={t.id} className={`flex items-center justify-between gap-3 p-4 ${i ? "border-t border-border" : ""}`}>
              <div className="flex items-center gap-3">
                <s.icon className={`size-6 ${s.color}`} />
                <div>
                  <p className="font-extrabold">EG {Number(t.amount).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{t.method} • {new Date(t.created_at).toLocaleString("ar-EG")}</p>
                  {t.admin_note && <p className="text-xs text-gold mt-1">ملاحظة: {t.admin_note}</p>}
                </div>
              </div>
              <span className={`text-xs font-bold ${s.color}`}>{s.label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-center">
        <Link to="/" className="text-sm text-gold hover:underline">العودة للرئيسية</Link>
      </div>
    </AppLayout>
  );
}
