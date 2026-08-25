import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { FramedImage } from "@/components/FramedImage";
import { CategoryDrawer } from "@/components/CategoryDrawer";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAllActiveCollections } from "@/lib/collections.functions";
import { Search as SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { useLang, pickLocalized } from "@/i18n/LanguageProvider";

const searchSchema = z.object({ q: z.string().optional().catch("") });

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — Lion Store / بحث" },
      { name: "description", content: "Search Lion Store categories for your favorite game or app." },
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
  const listFn = useServerFn(listAllActiveCollections);
  const collections = useQuery({ queryKey: ["all-collections"], queryFn: () => listFn() });
  const { t, dir, lang } = useLang();
  const [drawerSlug, setDrawerSlug] = useState<string | null>(null);

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
      <h1 className="text-3xl font-black text-gold-gradient mb-5">{t("بحث", "Search")}</h1>
      <div className="relative">
        <SearchIcon className={`absolute ${dir === "rtl" ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 size-5 text-gold`} />
        <input
          value={q}
          onChange={(e) => navigate({ search: { q: e.target.value || undefined }, replace: true })}
          placeholder={t("ابحث عن قسم أو فئة...", "Search for a category...")}
          className={`w-full rounded-full bg-secondary/60 border-gold py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-gold/50 ${dir === "rtl" ? "pr-12 pl-4" : "pl-12 pr-4"}`}
          autoFocus
        />
      </div>

      {collections.isLoading && <p className="mt-8 text-center text-muted-foreground">{t("جاري التحميل...", "Loading...")}</p>}

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
        {!collections.isLoading && results.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-12">{t("لا توجد نتائج", "No results")}</p>
        )}
      </div>

      <CategoryDrawer slug={drawerSlug} onClose={() => setDrawerSlug(null)} />
    </AppLayout>
  );
}
