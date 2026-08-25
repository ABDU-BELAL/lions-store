import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { FramedImage } from "@/components/FramedImage";
import { CategoryDrawer } from "@/components/CategoryDrawer";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAllActiveCollections } from "@/lib/collections.functions";
import { getMyAccount } from "@/lib/account.functions";
import { useAuth } from "@/hooks/useAuth";
import { Search as SearchIcon, Wallet, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { useLang, pickLocalized } from "@/i18n/LanguageProvider";
import { useCurrency } from "@/i18n/CurrencyProvider";

const shopSearch = z.object({ q: z.string().optional().catch("") });

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop — Lion Store / المتجر" },
      { name: "description", content: "Browse Lion Store categories — top up games and apps at competitive prices with instant delivery." },
      { property: "og:url", content: "https://lions-stores.com/shop" },
    ],
    links: [{ rel: "canonical", href: "https://lions-stores.com/shop" }],
  }),
  validateSearch: shopSearch,
  component: ShopPage,
});

function ShopPage() {
  const { user } = useAuth();
  const { q = "" } = Route.useSearch();
  const navigate = useNavigate({ from: "/shop" });
  const listFn = useServerFn(listAllActiveCollections);
  const accountFn = useServerFn(getMyAccount);
  const { t, dir, lang } = useLang();
  const { format } = useCurrency();
  const [drawerSlug, setDrawerSlug] = useState<string | null>(null);

  const collections = useQuery({ queryKey: ["all-collections"], queryFn: () => listFn() });
  const account = useQuery({ queryKey: ["account"], queryFn: () => accountFn(), enabled: !!user });
  const balance = Number(account.data?.balance ?? 0);

  const list = collections.data ?? [];
  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter((c) =>
      c.title.toLowerCase().includes(query) ||
      ((c as { title_en?: string | null }).title_en ?? "").toLowerCase().includes(query) ||
      (c.slug ?? "").toLowerCase().includes(query),
    );
  }, [list, q]);

  return (
    <AppLayout>
      <div className="rounded-3xl bg-dark-gradient border-gold p-6 shadow-card flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gold-gradient">{t("المتجر", "Shop")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("اختر القسم لعرض المنتجات بداخله.", "Pick a category to view its products.")}</p>
        </div>
        {user && (
          <Link to="/topup" className="hidden sm:flex items-center gap-2 rounded-2xl border-gold bg-gradient-to-l from-gold-deep/30 to-gold/10 px-4 py-3">
            <Wallet className="size-5 text-gold" />
            <div>
              <p className="text-[10px] text-muted-foreground">{t("رصيدك", "Your balance")}</p>
              <p className="text-sm font-black text-gold-gradient">{format(balance)}</p>
            </div>
          </Link>
        )}
      </div>

      <div className="mt-5 relative">
        <SearchIcon className={`absolute ${dir === "rtl" ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 size-5 text-gold`} />
        <input
          value={q}
          onChange={(e) => navigate({ search: { q: e.target.value || undefined }, replace: true })}
          placeholder={t("ابحث عن قسم...", "Search for a category...")}
          className={`w-full rounded-full bg-secondary/60 border border-border py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 ${dir === "rtl" ? "pr-12 pl-4" : "pl-12 pr-4"}`}
        />
      </div>

      {collections.isLoading && <p className="mt-8 text-center text-muted-foreground">{t("جاري التحميل...", "Loading...")}</p>}
      {!collections.isLoading && results.length === 0 && (
        <div className="mt-10 text-center text-muted-foreground">
          <ShoppingBag className="mx-auto size-12 mb-3 opacity-50" />
          <p>{q ? t("لا توجد نتائج لبحثك", "No results for your search") : t("لا توجد أقسام حاليًا.", "No categories yet.")}</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {results.map((c) => {
          const title = pickLocalized(c.title, (c as { title_en?: string | null }).title_en, lang);
          return (
            <button key={c.id} type="button" onClick={() => setDrawerSlug(c.slug)} className="group rounded-2xl overflow-hidden bg-dark-gradient border border-gold/30 hover:border-gold/70 hover:shadow-gold transition text-center">
              <FramedImage src={c.image_url} alt={title} framed={(c as { show_frame?: boolean }).show_frame !== false} />
              <p className="font-extrabold text-sm p-3 text-gold-gradient">{title}</p>
            </button>
          );
        })}
      </div>

      <CategoryDrawer slug={drawerSlug} onClose={() => setDrawerSlug(null)} />
    </AppLayout>
  );
}
