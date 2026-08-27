import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ShieldCheck, MessageCircle, IdCard, Camera } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/kyc")({
  head: () => ({
    meta: [
      { title: "KYC Verification — Lion Store / توثيق الحساب" },
      { name: "description", content: "Verify your Lion Store account (KYC) to raise limits and secure your wallet." },
      { property: "og:title", content: "KYC Verification — Lion Store" },
      { property: "og:description", content: "Verify your Lion Store account to raise limits and secure your wallet." },
    ],
  }),
  component: Kyc,
});

function Kyc() {
  const { t } = useLang();
  const steps = [
    { icon: IdCard, title: t("صورة إثبات الهوية", "Photo ID"), desc: t("بطاقة رقم قومي أو جواز سفر ساري.", "National ID card or a valid passport.") },
    { icon: Camera, title: t("صورة سيلفي", "Selfie"), desc: t("صورة واضحة لك وأنت ممسك بالإثبات.", "A clear selfie while holding your ID.") },
    { icon: ShieldCheck, title: t("المراجعة", "Review"), desc: t("يتم الرد خلال 24 ساعة كحد أقصى.", "We respond within 24 hours.") },
  ];

  return (
    <AppLayout>
      <div className="rounded-3xl bg-dark-gradient border-gold p-8 text-center shadow-card">
        <div className="mx-auto grid place-items-center size-16 rounded-2xl bg-gold-gradient text-primary-foreground">
          <ShieldCheck className="size-8" />
        </div>
        <h1 className="mt-4 text-3xl font-black text-gold-gradient">{t("توثيق الحساب (KYC)", "KYC verification")}</h1>
        <p className="mt-3 max-w-2xl mx-auto text-muted-foreground">
          {t(
            "التوثيق يرفع حدود الشحن ويحمي محفظتك من أي محاولة استيلاء. أرسل مستنداتك عبر واتساب وسيتم مراجعتها يدويًا.",
            "Verification raises your top-up limits and protects your wallet from takeover attempts. Send your documents on WhatsApp and our team reviews them manually.",
          )}
        </p>
      </div>

      <div className="mt-6 grid sm:grid-cols-3 gap-4">
        {steps.map((s) => (
          <div key={s.title} className="p-5 rounded-2xl bg-card/70 border border-border">
            <div className="grid place-items-center size-11 rounded-xl bg-gold-gradient text-primary-foreground"><s.icon className="size-5" /></div>
            <p className="mt-3 font-extrabold">{s.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>

      <a
        href="https://wa.me/201010594146?text=KYC"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-gold-gradient text-primary-foreground px-5 py-3 font-extrabold"
      >
        <MessageCircle className="size-5" /> {t("ابدأ التوثيق عبر واتساب", "Start verification on WhatsApp")}
      </a>
    </AppLayout>
  );
}
