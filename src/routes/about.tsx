import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { MessageCircle, Mail } from "lucide-react";
import logo from "@/assets/logo.jpeg.asset.json";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "من نحن — Lion Store" },
      { name: "description", content: "تعرف على ليون ستور: وجهتك الأولى لشحن الألعاب والتطبيقات في مصر والوطن العربي بأفضل الأسعار ودعم فني 24/7." },
      { property: "og:title", content: "من نحن — قصة Lion Store" },
      { property: "og:description", content: "ليون ستور — أمانة، احترافية، وأسرع شحن للألعاب والتطبيقات." },
      { property: "og:url", content: "https://lions-stores.com/about" },
    ],
    links: [{ rel: "canonical", href: "https://lions-stores.com/about" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: "Lion Store",
        alternateName: "ليون ستور",
        url: "https://lions-stores.com/about",
        image: "https://lions-stores.com/favicon.ico",
        description: "متجر شحن الألعاب والتطبيقات في مصر والوطن العربي.",
        telephone: "+20-101-059-4146",
        email: "lions.storeeg@gmail.com",
        areaServed: "EG",
      }),
    }],
  }),
  component: About,
});

function About() {
  return (
    <AppLayout>
      <div className="rounded-3xl bg-dark-gradient border-gold p-8 text-center shadow-card">
        <img src={logo.url} alt="Lion Store" className="mx-auto size-28 rounded-full ring-4 ring-gold/40 shadow-gold" />
        <h1 className="mt-4 text-3xl md:text-5xl font-black text-gold-gradient">من نحن</h1>
        <p className="mt-4 max-w-2xl mx-auto text-muted-foreground">
          ليون ستور هو وجهتك الأولى لشحن الألعاب والتطبيقات في مصر والوطن العربي. نوفر لك أفضل الأسعار، أسرع توصيل،
          ودعم فني على مدار الساعة. مهمتنا هي أن نثبت معك بالأمانة والاحترافية.
        </p>
      </div>

      <div className="mt-6 grid sm:grid-cols-2 gap-4">
        {[
          { icon: MessageCircle, label: "واتساب", value: "+20 101 059 4146", href: "https://wa.me/201010594146" },
          { icon: Mail, label: "البريد", value: "lions.storeeg@gmail.com", href: "mailto:lions.storeeg@gmail.com" },
        ].map((c) => (
          <a key={c.label} href={c.href} className="flex items-center gap-4 p-5 rounded-2xl bg-card/70 border border-border hover:border-gold/50 transition">
            <div className="grid place-items-center size-12 rounded-xl bg-gold-gradient text-primary-foreground"><c.icon className="size-6" /></div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="font-extrabold" dir="auto">{c.value}</p>
            </div>
          </a>
        ))}
      </div>

    </AppLayout>
  );
}
