import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAccount } from "@/lib/account.functions";
import { createTopupRequest, listMyTopups, getPaymentMethods } from "@/lib/topup.functions";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Wallet, Phone, Building2, Bitcoin, Clock, CheckCircle2, XCircle, Copy, ExternalLink, Upload } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { useCurrency } from "@/i18n/CurrencyProvider";

export const Route = createFileRoute("/topup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Top up — Lion Store / شحن الرصيد" },
      { name: "description", content: "Top up your Lion Store wallet to purchase any product on the store." },
      { property: "og:url", content: "https://lions-stores.com/topup" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://lions-stores.com/topup" }],
  }),
  beforeLoad: async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const { redirect } = await import("@tanstack/react-router");
      throw redirect({ to: "/login" });
    }
  },
  component: TopupPage,
});

function TopupPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getAccount = useServerFn(getMyAccount);
  const createTopup = useServerFn(createTopupRequest);
  const myTopups = useServerFn(listMyTopups);
  const fetchPaymentMethods = useServerFn(getPaymentMethods);
  const { t, lang } = useLang();
  const { format } = useCurrency();

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/login", replace: true }); }, [authLoading, user, navigate]);

  const account = useQuery({ queryKey: ["account", user?.id], queryFn: () => getAccount(), enabled: !!user });
  const topups = useQuery({ queryKey: ["my-topups"], queryFn: () => myTopups(), enabled: !!user });
  const paymentMethods = useQuery({ queryKey: ["payment-methods"], queryFn: () => fetchPaymentMethods() });

  const methodMeta = [
    { id: "vodafone_cash" as const, label: t("فودافون كاش", "Vodafone Cash"), icon: Phone, color: "bg-red-600" },
    { id: "instapay" as const, label: t("إنستا باي", "InstaPay"), icon: Building2, color: "bg-purple-600" },
    { id: "binance" as const, label: "USDT (TRC20)", icon: Bitcoin, color: "bg-yellow-500" },
  ];

  const statusMap = {
    pending: { label: t("قيد المراجعة", "Under review"), icon: Clock, color: "text-gold" },
    approved: { label: t("تم القبول", "Approved"), icon: CheckCircle2, color: "text-emerald-400" },
    rejected: { label: t("مرفوض", "Rejected"), icon: XCircle, color: "text-destructive" },
  } as const;

  const [method, setMethod] = useState<typeof methodMeta[number]["id"]>("vodafone_cash");
  const [amount, setAmount] = useState<number>(100);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: async (vars: { amount: number; method: typeof method; reference: string; note?: string }) => {
      let screenshot_path: string | undefined;
      if (screenshot) {
        if (!user) throw new Error(t("سجل الدخول أولاً", "Sign in first"));
        setUploading(true);
        const ext = (screenshot.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("topup-receipts")
          .upload(path, screenshot, { contentType: screenshot.type || "image/jpeg", upsert: false });
        setUploading(false);
        if (upErr) throw new Error(t("فشل رفع صورة الإيصال: ", "Receipt upload failed: ") + upErr.message);
        screenshot_path = path;
      }
      return createTopup({ data: { ...vars, screenshot_path } });
    },
    onSuccess: () => {
      toast.success(t("تم إرسال طلب الشحن! هيتم مراجعته خلال دقائق.", "Top-up request sent! It will be reviewed within minutes."));
      setReference(""); setNote(""); setScreenshot(null);
      qc.invalidateQueries({ queryKey: ["my-topups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authLoading || !user) {
    return (
      <AppLayout>
        <div className="min-h-[40vh] grid place-items-center text-muted-foreground">{t("جاري التحقق من الجلسة...", "Verifying session...")}</div>
      </AppLayout>
    );
  }

  const pm = paymentMethods.data;
  const accountFor = (id: typeof method): string => {
    if (!pm) return "";
    if (id === "vodafone_cash") return pm.vodafone_cash;
    if (id === "instapay") return pm.instapay_account;
    return pm.binance;
  };
  const enabledFor = (id: typeof method): boolean => {
    if (!pm) return true;
    if (id === "vodafone_cash") return pm.vodafone_cash_enabled;
    if (id === "instapay") return pm.instapay_enabled;
    return pm.binance_enabled;
  };
  const active = methodMeta.find((m) => m.id === method)!;
  const activeAccount = accountFor(method);
  const activeLink = method === "instapay" ? pm?.instapay_link : "";
  const activeEnabled = enabledFor(method);
  const locale = lang === "en" ? "en-US" : "ar-EG";

  const copyAccount = () => {
    navigator.clipboard.writeText(activeAccount);
    toast.success(t("تم نسخ البيانات", "Copied"));
  };

  return (
    <AppLayout>
      <div className="rounded-3xl bg-dark-gradient border-gold shadow-card p-6 flex items-center gap-4">
        <div className="grid place-items-center size-14 rounded-2xl bg-gold-gradient text-primary-foreground"><Wallet className="size-7" /></div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">{t("رصيدك الحالي", "Your current balance")}</p>
          <p dir="ltr" className="text-3xl font-black text-gold-gradient">{format(Number(account.data?.balance ?? 0))}</p>
          {account.data?.profile?.custom_id && (
            <p className="text-xs text-muted-foreground mt-1">{t("رقم حسابك:", "Your account ID:")} <span dir="ltr" className="font-extrabold text-gold">#{account.data.profile.custom_id}</span></p>
          )}
        </div>
      </div>

      <h1 className="mt-6 text-2xl md:text-3xl font-black text-gold-gradient">{t("شحن الرصيد", "Top up balance")}</h1>
      <p className="text-muted-foreground text-sm mt-1">{t("اختار طريقة الدفع، حوّل المبلغ، وارفع صورة الإيصال + رقم العملية. هنراجع الطلب يدويًا وننزّل الرصيد على محفظتك.", "Choose a payment method, send the amount, upload the receipt and transaction ID. We'll review manually and credit your wallet.")}</p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {methodMeta.map((m) => {
          const isEnabled = enabledFor(m.id);
          return (
            <button
              key={m.id}
              onClick={() => isEnabled && setMethod(m.id)}
              disabled={!isEnabled}
              className={`relative p-4 rounded-2xl border transition ${method === m.id ? "border-gold/70 bg-gradient-to-b from-gold/20 to-card shadow-gold" : "border-border bg-card/70 hover:border-gold/40"} ${!isEnabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className={`grid place-items-center size-10 rounded-xl ${m.color} text-white mb-2`}><m.icon className="size-5" /></div>
              <p className="font-extrabold text-sm">{m.label}</p>
              {!isEnabled && (
                <span className="absolute top-1 left-1 text-[9px] font-extrabold bg-destructive text-destructive-foreground rounded-full px-2 py-0.5">{t("صيانة", "Maintenance")}</span>
              )}
            </button>
          );
        })}
      </div>

      {!activeEnabled ? (
        <div className="mt-4 rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-center">
          <p className="font-extrabold text-destructive">⚠️ {active.label} {t("تحت الصيانة حاليًا", "is under maintenance")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("من فضلك اختر وسيلة دفع أخرى متاحة.", "Please choose another available payment method.")}</p>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-gold/40 bg-card/70 p-4">
          <p className="text-sm">{t("حوّل المبلغ على ", "Send the amount via ")}<span className="font-extrabold text-gold-gradient">{active.label}</span>:</p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <p dir="ltr" className="flex-1 min-w-0 text-base sm:text-lg font-black text-gold-gradient break-all">{activeAccount || "..."}</p>
            <button type="button" onClick={copyAccount} className="shrink-0 rounded-lg bg-secondary/70 border border-border px-3 py-1.5 text-xs font-bold flex items-center gap-1 hover:border-gold/40">
              <Copy className="size-3.5" /> {t("نسخ", "Copy")}
            </button>
            {activeLink && (
              <a href={activeLink} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg bg-gold-gradient text-primary-foreground px-3 py-1.5 text-xs font-bold flex items-center gap-1">
                <ExternalLink className="size-3.5" /> {t("فتح الرابط", "Open link")}
              </a>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t("بعد التحويل، ارفع صورة الإيصال واكتب رقم العملية وابعت الطلب.", "After paying, upload the receipt, enter the transaction ID, and submit.")}</p>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate({ amount, method, reference, note: note || undefined }); }}
        className="mt-4 rounded-2xl bg-card/70 border border-border p-5 space-y-3"
      >
        <div>
          <label className="text-xs font-bold mb-1 block">{t("المبلغ (EGP) — الحد الأدنى 100", "Amount (EGP) — minimum 100")}</label>
          <input dir="ltr" type="number" min={100} max={1000000} required value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold/50" />
        </div>
        <div>
          <label className="text-xs font-bold mb-1 block">{t("رقم العملية / المرجع", "Transaction ID / reference")}</label>
          <input required minLength={3} maxLength={200} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("مثلاً: TXN12345 أو 4 أرقام أخيرة من رقم المحول منه", "e.g. TXN12345 or last 4 digits of the sender number")} className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold/50" />
        </div>

        <div>
          <label className="text-xs font-bold mb-1 block">{t("صورة إيصال التحويل (اختياري لكن يُفضّل)", "Receipt image (optional but recommended)")}</label>
          <label className="flex items-center justify-center gap-2 rounded-xl bg-secondary/60 border-2 border-dashed border-border px-4 py-4 cursor-pointer hover:border-gold/50 transition">
            <Upload className="size-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground truncate">
              {screenshot ? screenshot.name : t("اختر صورة الإيصال", "Choose receipt image")}
            </span>
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.size > 5 * 1024 * 1024) { toast.error(t("حجم الصورة كبير، الحد الأقصى 5 ميجا", "Image too large — max 5MB")); return; }
                setScreenshot(f);
              }} />
          </label>
          {screenshot && (
            <button type="button" onClick={() => setScreenshot(null)} className="mt-1 text-xs text-destructive">{t("إزالة الصورة", "Remove image")}</button>
          )}
        </div>

        <div>
          <label className="text-xs font-bold mb-1 block">{t("ملاحظات (اختياري)", "Notes (optional)")}</label>
          <textarea maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold/50 resize-none" />
        </div>
        <button disabled={mutation.isPending || uploading || !activeEnabled || amount < 100} className="w-full rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold disabled:opacity-50">
          {!activeEnabled ? t("تحت الصيانة", "Under maintenance") : uploading ? t("جاري رفع الصورة...", "Uploading image...") : mutation.isPending ? t("جاري الإرسال...", "Sending...") : t("إرسال طلب الشحن", "Send top-up request")}
        </button>
      </form>

      <h2 className="mt-8 text-xl font-extrabold text-gold-gradient">{t("سجل طلبات الشحن", "Top-up history")}</h2>
      <div className="mt-3 rounded-2xl overflow-hidden border border-border bg-card/70">
        {(topups.data ?? []).length === 0 && <p className="p-6 text-center text-muted-foreground text-sm">{t("لا توجد طلبات بعد", "No requests yet")}</p>}
        {(topups.data ?? []).map((row, i) => {
          const s = statusMap[row.status as keyof typeof statusMap];
          return (
            <div key={row.id} className={`flex items-center justify-between gap-3 p-4 ${i ? "border-t border-border" : ""}`}>
              <div className="flex items-center gap-3">
                <s.icon className={`size-6 ${s.color}`} />
                <div>
                  <p dir="ltr" className="font-extrabold">{format(Number(row.amount))}</p>
                  <p className="text-xs text-muted-foreground">{row.method} • {new Date(row.created_at).toLocaleString(locale)}</p>
                  {row.admin_note && <p className="text-xs text-gold mt-1">{t("ملاحظة:", "Note:")} {row.admin_note}</p>}
                </div>
              </div>
              <span className={`text-xs font-bold ${s.color}`}>{s.label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-center">
        <Link to="/" className="text-sm text-gold hover:underline">{t("العودة للرئيسية", "Back to home")}</Link>
      </div>
    </AppLayout>
  );
}
