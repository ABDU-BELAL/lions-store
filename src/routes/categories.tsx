import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { FramedImage } from "@/components/FramedImage";
import { listActiveCollections } from "@/lib/collections.functions";
import { CreditCard, Headphones } from "lucide-react";
import { useLang, pickLocalized } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "Categories — Lion Store / الأقسام" },
      { name: "description", content: "Browse Lion Store categories: games, apps, packages, and special offers." },
      { property: "og:title", content: "Categories — Lion Store" },
      { property: "og:description", content: "All top-up categories in one place." },
      { property: "og:url", content: "https://lions-stores.com/categories" },
    ],
    links: [{ rel: "canonical", href: "https://lions-stores.com/categories" }],
  }),
  component: Categories,
});

function Categories() {
  const fn = useServerFn(listActiveCollections);
  const { data: collections = [] } = useQuery({ queryKey: ["collections-active"], queryFn: () => fn() });
  const { t, lang } = useLang();

  const systemLinks = [
    { to: "/payments" as const, label: t("طرق الدفع", "Payment methods"), icon: CreditCard },
    { to: "/about" as const, label: t("الدعم الفني", "Support"), icon: Headphones },
  ];

  return (
    <AppLayout>
      <h1 className="text-3xl font-black text-gold-gradient mb-6">{t("الأقسام", "Categories")}</h1>

      {collections.length === 0 && (
        <p className="text-center text-muted-foreground py-8">{t("لا يوجد أقسام بعد.", "No categories yet.")}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {collections.map((c) => {
          const title = pickLocalized(c.title, (c as { title_en?: string | null }).title_en, lang);
          return (
            <Link key={c.id} to="/collection/$slug" params={{ slug: c.slug }} className="group rounded-2xl overflow-hidden bg-dark-gradient border border-gold/30 hover:border-gold/70 hover:shadow-gold transition text-center">
              <FramedImage src={c.image_url} alt={title} framed={(c as { show_frame?: boolean }).show_frame !== false} />
              <p className="font-extrabold text-sm p-3 text-gold-gradient">{title}</p>
            </Link>
          );
        })}

        {systemLinks.map((c) => (
          <Link key={c.label} to={c.to} className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-card/70 border border-border hover:border-gold/60 hover:shadow-gold transition">
            <div className="grid place-items-center size-14 rounded-2xl bg-gold-gradient text-primary-foreground"><c.icon className="size-7" /></div>
            <span className="font-extrabold text-center">{c.label}</span>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
