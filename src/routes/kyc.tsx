import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ShieldCheck, Upload, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getMyKyc, submitKyc, KYC_SLOTS, type KycDocType } from "@/lib/kyc.functions";

export const Route = createFileRoute("/kyc")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "KYC Verification — Lion Store / توثيق الحساب" },
      { name: "description", content: "Verify your Lion Store account (KYC) to raise limits and unlock payment methods." },
      { property: "og:title", content: "KYC Verification — Lion Store" },
      { property: "og:description", content: "Verify your Lion Store account to raise limits and unlock payment methods." },
    ],
  }),
  component: Kyc,
});

const DOC_TYPES: { id: KycDocType; ar: string; en: string }[] = [
  { id: "passport", ar: "جواز سفر", en: "Passport" },
  { id: "id_card", ar: "بطاقة الرقم القومي", en: "Identity card" },
  { id: "residence_permit", ar: "تصريح إقامة", en: "Residence permit" },
];

// Compress phone photos (often 3-8MB) down to ~<500KB before upload to avoid
// FUNCTION_PAYLOAD_TOO_LARGE. Resizes to max 1280px and re-encodes as JPEG.
async function compressImage(file: File, maxDim = 1280, quality = 0.75): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  let { width, height } = bitmap;
  if (width <= maxDim && height <= maxDim && file.size <= 500 * 1024) {
    bitmap.close();
    return file;
  }
  const scale = Math.min(1, maxDim / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) { bitmap.close(); return file; }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  let q = quality;
  let blob: Blob | null = null;
  // Reduce quality until under 500KB (min 0.5)
  while (q >= 0.5) {
    blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", q));
    if (blob && blob.size <= 500 * 1024) break;
    q -= 0.1;
  }
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

function Kyc() {
  const { t } = useLang();
  const { user, loading } = useAuth();
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const ua = navigator.userAgent || "";
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(ua));
  }, []);
  const qc = useQueryClient();
  const fetchKyc = useServerFn(getMyKyc);
  const submitFn = useServerFn(submitKyc);

  const [docType, setDocType] = useState<KycDocType>("passport");
  const [files, setFiles] = useState<(File | null)[]>([null, null, null]);
  const [fullName, setFullName] = useState("");
  const [docNumber, setDocNumber] = useState("");

  const kyc = useQuery({ queryKey: ["my-kyc"], queryFn: () => fetchKyc(), enabled: !!user });

  const slots = KYC_SLOTS[docType];

  const submit = useMutation({
    mutationFn: async () => {
      const needed = slots.length;
      const chosen = files.slice(0, needed);
      if (chosen.some((f) => !f)) throw new Error(t("من فضلك ارفع كل الصور المطلوبة", "Please upload all required photos"));
      const fd = new FormData();
      fd.append("doc_type", docType);
      fd.append("full_name", fullName);
      fd.append("document_number", docNumber);
      for (const f of chosen) fd.append("files", f as File);
      return submitFn({ data: fd });
    },
    onSuccess: () => {
      toast.success(t("تم إرسال طلب التوثيق، سيتم المراجعة قريبًا", "Verification submitted, we'll review shortly"));
      setFiles([null, null, null]);
      qc.invalidateQueries({ queryKey: ["my-kyc"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = kyc.data?.status ?? "none";
  const statusMeta = {
    none: { icon: ShieldCheck, color: "text-muted-foreground", label: t("غير موثّق", "Not verified") },
    pending: { icon: Clock, color: "text-gold", label: t("قيد المراجعة", "Under review") },
    approved: { icon: CheckCircle2, color: "text-emerald-400", label: t("موثّق ✅", "Verified") },
    rejected: { icon: XCircle, color: "text-destructive", label: t("مرفوض", "Rejected") },
  }[status];
  const StatusIcon = statusMeta.icon;

  return (
    <AppLayout>
      <div className="rounded-3xl bg-dark-gradient border-gold p-8 text-center shadow-card">
        <div className="mx-auto grid place-items-center size-16 rounded-2xl bg-gold-gradient text-primary-foreground">
          <ShieldCheck className="size-8" />
        </div>
        <h1 className="mt-4 text-3xl font-black text-gold-gradient">{t("توثيق الحساب (KYC)", "KYC verification")}</h1>
        <p className="mt-3 max-w-2xl mx-auto text-muted-foreground">
          {t(
            "التوثيق يرفع حدود الشحن ويفتح وسائل دفع إضافية. ارفع مستنداتك وسيتم مراجعتها يدويًا.",
            "Verification raises your limits and unlocks extra payment methods. Upload your documents for manual review.",
          )}
        </p>
        {user && (
          <p className={`mt-4 inline-flex items-center gap-2 font-extrabold ${statusMeta.color}`}>
            <StatusIcon className="size-5" /> {statusMeta.label}
          </p>
        )}
        {kyc.data?.latest?.admin_note && (
          <p className="mt-2 text-xs text-muted-foreground">{kyc.data.latest.admin_note}</p>
        )}
      </div>

      {!loading && !user && (
        <div className="mt-6 rounded-2xl border border-border bg-card/70 p-6 text-center">
          <p className="font-extrabold">{t("سجّل الدخول لبدء التوثيق", "Sign in to start verification")}</p>
          <Link to="/login" className="mt-3 inline-block rounded-xl bg-gold-gradient text-primary-foreground px-5 py-2 font-extrabold">
            {t("تسجيل الدخول", "Sign in")}
          </Link>
        </div>
      )}

      {user && status !== "pending" && status !== "approved" && isMobile === true && (
        <div className="mt-6 rounded-2xl border border-border bg-card/70 p-5 space-y-4">
          <div>
            <label className="text-xs font-bold">{t("نوع المستند", "Document type")}</label>
            <select
              value={docType}
              onChange={(e) => { setDocType(e.target.value as KycDocType); setFiles([null, null, null]); }}
              className="mt-1 w-full rounded-xl bg-secondary/60 border border-border px-4 py-3"
            >
              {DOC_TYPES.map((d) => (
                <option key={d.id} value={d.id}>{t(d.ar, d.en)}</option>
              ))}
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold">{t("الاسم كما في المستند", "Name as on document")}</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 w-full rounded-xl bg-secondary/60 border border-border px-4 py-3" />
            </div>
            <div>
              <label className="text-xs font-bold">{t("رقم المستند", "Document number")}</label>
              <input dir="ltr" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} className="mt-1 w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 text-right" />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {slots.map((s, i) => (
              <label key={i} className="cursor-pointer rounded-2xl border border-dashed border-gold/40 bg-secondary/40 p-4 text-center hover:border-gold">
                <input
                  type="file"
                  accept="image/*"
                  capture={i === slots.length - 1 ? "user" : "environment"}
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (!f) { setFiles((prev) => { const n = [...prev]; n[i] = null; return n; }); return; }
                    try {
                      const compressed = await compressImage(f);
                      setFiles((prev) => { const n = [...prev]; n[i] = compressed; return n; });
                    } catch {
                      setFiles((prev) => { const n = [...prev]; n[i] = f; return n; });
                    }
                  }}
                />
                {files[i] ? (
                  <img src={URL.createObjectURL(files[i]!)} alt="" className="mx-auto h-24 w-auto rounded-lg object-cover" />
                ) : (
                  <Upload className="mx-auto size-6 text-gold" />
                )}
                <p className="mt-2 text-xs font-bold">{t(s.ar, s.en)}</p>
              </label>
            ))}
          </div>

          <button
            disabled={submit.isPending}
            onClick={() => submit.mutate()}
            className="w-full rounded-2xl bg-gold-gradient text-primary-foreground px-5 py-3 font-extrabold disabled:opacity-50"
          >
            {submit.isPending ? t("جاري الإرسال...", "Submitting...") : t("إرسال طلب التوثيق", "Submit verification")}
          </button>
        </div>
      )}

      {user && status !== "pending" && status !== "approved" && isMobile === false && (
        <div className="mt-6 rounded-2xl border border-gold/40 bg-card/70 p-6 text-center">
          <p className="font-extrabold text-gold">
            {t("لإتمام عملية التوثيق، يرجى فتح هذه الصفحة من هاتفك المحمول لالتقاط الصور مباشرة بالكاميرا.", "To complete verification, please open this page on your mobile phone to take photos directly with the camera.")}
          </p>
        </div>
      )}

      {user && status === "pending" && (
        <div className="mt-6 rounded-2xl border border-gold/40 bg-card/70 p-6 text-center">
          <p className="font-extrabold text-gold">{t("طلبك قيد المراجعة، سيتم الرد خلال 24 ساعة.", "Your request is under review, we respond within 24 hours.")}</p>
        </div>
      )}
    </AppLayout>
  );
}
