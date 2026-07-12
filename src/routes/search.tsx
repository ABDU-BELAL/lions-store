import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ProductCard } from "@/components/ProductCard";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listShopProducts } from "@/lib/shop.functions";
import { Search as SearchIcon } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";
import { useLang, pickLocalized } from "@/i18n/LanguageProvider";

const searchSchema = z.object({ q: z.string().optional().catch("") });

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — Lion Store / بحث" },
      { name: "description", content: "Search Lion Store for your favorite game or app." },
      { property: "og:url", content: "https://lions-stores.com/search" },
    ],
    links: [{ rel: "canonical", href: "https://lions-stores.com/search" }],
  }),
  validateSearch: searchSchema,
  component: SearchPage,
});

function SearchPage() {
  const { q = "" } = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const listFn = useServerFn(listShopProducts);
  const products = useQuery({ queryKey: ["shop-products"], queryFn: () => listFn() });
  const { t, dir, lang } = useLang();

  const list = products.data ?? [];
  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter((p) =>
      p.title.toLowerCase().includes(query) ||
      ((p as { title_en?: string | null }).title_en ?? "").toLowerCase().includes(query) ||
      (p.description ?? "").toLowerCase().includes(query) ||
      (p.category ?? "").toLowerCase().includes(query),
    );
  }, [list, q]);

  return (
    <AppLayout>
      <h1 className="text-3xl font-black text-gold-gradient mb-5">{t("بحث", "Search")}</h1>
      <div className="relative">
        <SearchIcon className={`absolute ${dir === "rtl" ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 size-5 text-gold`} />
        <input
          value={q}
          onChange={(e) => navigate({ search: { q: e.target.value || undefined }, replace: true })}
          placeholder={t("ابحث عن لعبة أو تطبيق...", "Search for a game or app...")}
          className={`w-full rounded-full bg-secondary/60 border-gold py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-gold/50 ${dir === "rtl" ? "pr-12 pl-4" : "pl-12 pr-4"}`}
          autoFocus
        />
      </div>

      {products.isLoading && <p className="mt-8 text-center text-muted-foreground">{t("جاري التحميل...", "Loading...")}</p>}

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {results.map((p) => {
          const title = pickLocalized(p.title, (p as { title_en?: string | null }).title_en, lang);
          const oos = (p as { in_stock?: boolean }).in_stock === false;
          return (
            <ProductCard
              key={p.id}
              title={title}
              image={p.image_url || "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80"}
              to="/product/$id"
              params={{ id: p.id }}
              outOfStock={oos}
            />
          );

        })}
        {!products.isLoading && results.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-12">{t("لا توجد نتائج", "No results")}</p>
        )}
      </div>
    </AppLayout>
  );
}
