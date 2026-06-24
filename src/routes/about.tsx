import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { MessageCircle, Mail } from "lucide-react";
import logo from "@/assets/logo.jpeg.asset.json";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Lion Store / من نحن" },
      { name: "description", content: "Lion Store — your destination for game & app top-ups across Egypt and the Arab world." },
      { property: "og:title", content: "About — Lion Store" },
      { property: "og:description", content: "Lion Store — trust, professionalism, and the fastest top-ups." },
      { property: "og:url", content: "https://lions-stores.com/about" },
    ],
    links: [{ rel: "canonical", href: "https://lions-stores.com/about" }],
  }),
  component: About,
});

function About() {
  const { t } = useLang();
  return (
    <AppLayout>
      <div className="rounded-3xl bg-dark-gradient border-gold p-8 text-center shadow-card">
        <img src={logo.url} alt="Lion Store" className="mx-auto size-28 rounded-full ring-4 ring-gold/40 shadow-gold" />
        <h1 className="mt-4 text-3xl md:text-5xl font-black text-gold-gradient">{t("من نحن", "About us")}</h1>
        <p className="mt-4 max-w-2xl mx-auto text-muted-foreground">
          {t(
            "ليون ستور هو وجهتك الأولى لشحن الألعاب والتطبيقات في مصر والوطن العربي. نوفر لك أفضل الأسعار، أسرع توصيل، ودعم فني على مدار الساعة. مهمتنا هي أن نثبت معك بالأمانة والاحترافية.",
            "Lion Store is your number-one destination for game and app top-ups across Egypt and the Arab world. We offer the best prices, the fastest delivery, and 24/7 support. Our mission is to earn your trust through honesty and professionalism.",
          )}
        </p>
      </div>

      <div className="mt-6 grid sm:grid-cols-2 gap-4">
        {[
          { icon: MessageCircle, label: t("واتساب", "WhatsApp"), value: "01010594146", href: "https://wa.me/201010594146" },
          { icon: Mail, label: t("البريد", "Email"), value: "lions.storeeg@gmail.com", href: "mailto:lions.storeeg@gmail.com" },
        ].map((c) => (
          <a key={c.label} href={c.href} className="flex items-center gap-4 p-5 rounded-2xl bg-card/70 border border-border hover:border-gold/50 transition">
            <div className="grid place-items-center size-12 rounded-xl bg-gold-gradient text-primary-foreground"><c.icon className="size-6" /></div>
            <div>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="font-extrabold" dir="ltr">{c.value}</p>
            </div>
          </a>
        ))}
      </div>
    </AppLayout>
  );
}
