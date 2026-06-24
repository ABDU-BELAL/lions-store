import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Phone, Building2, Bitcoin } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/payments")({
  head: () => ({
    meta: [
      { title: "Payment Methods — Lion Store / طرق الدفع" },
      { name: "description", content: "Pay with Vodafone Cash, InstaPay, or USDT (TRC20). All transactions are secure and fast." },
      { property: "og:url", content: "https://lions-stores.com/payments" },
    ],
    links: [{ rel: "canonical", href: "https://lions-stores.com/payments" }],
  }),
  component: Payments,
});

function Payments() {
  const { t } = useLang();
  const methods = [
    { icon: Phone, name: t("فودافون كاش", "Vodafone Cash"), desc: "01040483540" },
    { icon: Building2, name: t("إنستا باي", "InstaPay"), desc: "islam20304050@instapay" },
    { icon: Building2, name: t("إنستا باي (رقم)", "InstaPay (phone)"), desc: "01040483540" },
    { icon: Bitcoin, name: "USDT (TRC20)", desc: "TS3NudYfcXA3cUBqZmMUFPpidZRdFG86PD" },
  ];

  return (
    <AppLayout>
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-5xl font-black text-gold-gradient">{t("طرق الدفع", "Payment methods")}</h1>
        <p className="mt-3 text-muted-foreground">{t("ادفع بالطريقة التي تناسبك — جميع المعاملات آمنة ومشفرة", "Pay your way — all transactions are secure and encrypted")}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {methods.map((m) => (
          <div key={m.name + m.desc} className="flex items-center gap-4 p-5 rounded-2xl bg-card/70 border border-border hover:border-gold/50 transition">
            <div className="grid place-items-center size-14 rounded-xl bg-gold-gradient text-primary-foreground shrink-0">
              <m.icon className="size-7" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold">{m.name}</h3>
              <p dir="ltr" className="text-sm text-muted-foreground break-all">{m.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
