import { Link } from "@tanstack/react-router";
import proframe from "@/assets/proframe.png.asset.json";
import { useLang } from "@/i18n/LanguageProvider";

interface Props {
  title: string;
  image: string;
  badge?: string;
  to?: string;
  search?: Record<string, string | undefined>;
  params?: Record<string, string>;
  outOfStock?: boolean;
}

export function ProductCard({ title, image, badge, to, search, params, outOfStock }: Props) {

  const { t, dir } = useLang();
  const inner = (
    <div className={`relative rounded-2xl overflow-hidden bg-dark-gradient shadow-card border border-gold/20 transition-transform group-hover:-translate-y-1 group-hover:shadow-gold ${outOfStock ? "opacity-80" : ""}`}>
      {outOfStock && (
        <>
          <span className={`absolute top-2 ${dir === "rtl" ? "left-2" : "right-2"} z-30 text-[10px] font-extrabold bg-destructive text-destructive-foreground rounded-full px-2 py-1 shadow`}>
            {t("نفد المخزون", "Out of stock")}
          </span>
          <div className="absolute inset-0 z-20 bg-background/40 pointer-events-none" />
        </>
      )}
      {/* Frame container */}
      <div className="relative aspect-square p-6 flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_oklch(0.7_0.18_75/_18%),_transparent_65%)]" />
        <div className="relative w-full h-full grid place-items-center">
          <img src={image} alt={title} className={`absolute inset-[18%] w-[64%] h-[64%] object-cover rounded-2xl shadow-card z-10 ${outOfStock ? "grayscale" : ""}`} />
          <img src={proframe.url} alt="" aria-hidden className="relative w-full h-full object-contain drop-shadow-[0_0_20px_oklch(0.7_0.18_75/_40%)]" />
        </div>
      </div>

      <div className="px-4 pb-4 pt-1 text-center">
        <h2 className="text-base font-extrabold text-gold-gradient">{title}</h2>
        {badge && <p className="mt-1 text-[11px] text-muted-foreground">{badge}</p>}
        {outOfStock && (
          <p className="mt-1 text-[11px] font-bold text-destructive">{t("غير متاح للشراء", "Unavailable")}</p>
        )}
      </div>

      <div className="absolute inset-x-0 top-0 h-1 bg-gold-gradient opacity-80" />
    </div>
  );

  if (to && !outOfStock) {
    return (
      <Link to={to as never} search={search as never} className="group relative block w-full text-right cursor-pointer">
        {inner}
      </Link>
    );
  }

  return <div className={`group relative block w-full text-right ${outOfStock ? "cursor-not-allowed" : ""}`} aria-disabled={outOfStock || undefined}>{inner}</div>;
}
