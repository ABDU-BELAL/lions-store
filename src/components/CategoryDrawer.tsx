import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X, ChevronRight, ShoppingBag } from "lucide-react";
import { getCollectionBySlug } from "@/lib/collections.functions";
import { FramedImage } from "@/components/FramedImage";
import { CardPrice } from "@/components/CardPrice";
import { useLang, pickLocalized } from "@/i18n/LanguageProvider";

type DrawerProduct = {
  id: string;
  title: string;
  title_en?: string | null;
  price: number;
  price_usd?: number | null;
  image_url: string | null;
  is_offer: boolean;
  in_stock?: boolean;
  show_frame?: boolean;
};

type DrawerChild = {
  id: string;
  slug: string;
  title: string;
  title_en: string | null;
  image_url: string | null;
  show_frame?: boolean;
};

/**
 * Side panel that slides in (like a mobile sidebar) showing a category's
 * products and subcategories, instead of navigating away or expanding inline.
 */
export function CategoryDrawer({ slug, onClose }: { slug: string | null; onClose: () => void }) {
  const { t, lang, dir } = useLang();
  const fetchCol = useServerFn(getCollectionBySlug);
  const [stack, setStack] = useState<string[]>([]);
  const [visible, setVisible] = useState(false);

  // Reset drill-down history whenever a different root category is opened.
  useEffect(() => { setStack([]); }, [slug]);

  // Lock body scroll + trigger slide-in animation after mount.
  useEffect(() => {
    if (!slug) return;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => {
      document.body.style.overflow = "";
      cancelAnimationFrame(raf);
      setVisible(false);
    };
  }, [slug]);

  const activeSlug = stack.length ? stack[stack.length - 1] : slug;
  const { data, isLoading } = useQuery({
    queryKey: ["collection", activeSlug],
    queryFn: () => fetchCol({ data: { slug: activeSlug! } }),
    enabled: !!activeSlug,
  });

  if (!slug) return null;

  const side = dir === "rtl" ? "left-0" : "right-0";
  const hiddenX = dir === "rtl" ? "-translate-x-full" : "translate-x-full";
  const title = data ? pickLocalized(data.collection.title, (data.collection as { title_en?: string | null }).title_en, lang) : "";
  const children = (data?.children ?? []) as DrawerChild[];
  const products = (data?.products ?? []) as DrawerProduct[];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      {/* Sliding panel */}
      <div className={`absolute inset-y-0 ${side} w-full max-w-md bg-card border-gold shadow-card overflow-y-auto transition-transform duration-300 ease-out ${visible ? "translate-x-0" : hiddenX}`}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-2 bg-card/95 backdrop-blur border-b border-border px-4 py-3">
          {stack.length > 0 && (
            <button
              type="button"
              onClick={() => setStack((s) => s.slice(0, -1))}
              aria-label={t("رجوع", "Back")}
              className="grid place-items-center size-9 rounded-full bg-secondary shrink-0"
            >
              <ChevronRight className={`size-5 ${dir === "rtl" ? "" : "rotate-180"}`} />
            </button>
          )}
          <h2 className="flex-1 text-lg font-black text-gold-gradient truncate">{isLoading ? t("جاري التحميل...", "Loading...") : title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("إغلاق", "Close")}
            className="grid place-items-center size-9 rounded-full bg-secondary shrink-0"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="p-4">
          {isLoading && <p className="py-12 text-center text-muted-foreground">{t("جاري التحميل...", "Loading...")}</p>}

          {!isLoading && data && (
            <>
              {/* Subcategories */}
              {children.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {children.map((ch) => {
                    const chTitle = pickLocalized(ch.title, ch.title_en, lang);
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setStack((s) => [...s, ch.slug])}
                        className="group rounded-2xl overflow-hidden bg-dark-gradient border border-gold/30 hover:border-gold/70 transition text-center"
                      >
                        <FramedImage src={ch.image_url} alt={chTitle} framed={ch.show_frame !== false} />
                        <p className="font-extrabold text-[11px] p-2 text-gold-gradient line-clamp-1">{chTitle}</p>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Products */}
              {products.length === 0 ? (
                children.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground">
                    <ShoppingBag className="mx-auto size-12 mb-3 opacity-50" />
                    <p>{t("لا يوجد منتجات في هذا القسم بعد.", "No products in this category yet.")}</p>
                  </div>
                )
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {products.map((p) => {
                    const pTitle = pickLocalized(p.title, p.title_en, lang);
                    const oos = p.in_stock === false;
                    return (
                      <Link
                        key={p.id}
                        to="/product/$id"
                        params={{ id: p.id }}
                        onClick={onClose}
                        className={`group relative rounded-2xl overflow-hidden bg-dark-gradient border border-gold/20 hover:border-gold/60 hover:shadow-gold transition text-center ${oos ? "opacity-75 pointer-events-none" : ""}`}
                      >
                        {oos && (
                          <span className={`absolute top-2 ${dir === "rtl" ? "left-2" : "right-2"} z-20 text-[10px] font-extrabold bg-destructive text-destructive-foreground rounded-full px-2 py-1`}>
                            {t("نفد المخزون", "Out of stock")}
                          </span>
                        )}
                        <FramedImage src={p.image_url} alt={pTitle} framed={p.show_frame !== false} />
                        <div className="px-3 pb-3 pt-1">
                          <h3 className="text-xs font-extrabold text-gold-gradient line-clamp-1">{pTitle}</h3>
                          <CardPrice productId={p.id} price={Number(p.price)} priceUsd={p.price_usd ?? null} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Full page link */}
              <div className="mt-5 text-center">
                <Link
                  to="/collection/$slug"
                  params={{ slug: activeSlug! }}
                  onClick={onClose}
                  className="text-sm text-gold hover:underline font-bold"
                >
                  {t("فتح الصفحة الكاملة", "Open full page")}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
