import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listActiveBanners } from "@/lib/banners.functions";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLang, pickLocalized } from "@/i18n/LanguageProvider";

export function BannerSlideshow() {
  const fn = useServerFn(listActiveBanners);
  const { data } = useQuery({ queryKey: ["banners-active"], queryFn: () => fn(), staleTime: 60_000 });
  const banners = data ?? [];
  const { lang } = useLang();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setI((v) => (v + 1) % banners.length), 4500);
    return () => clearInterval(t);
  }, [banners.length]);

  if (banners.length === 0) return null;
  const current = banners[i % banners.length];

  const Wrap = ({ children }: { children: React.ReactNode }) =>
    current.link_url ? (
      <a href={current.link_url} target="_blank" rel="noreferrer" className="block">{children}</a>
    ) : (
      <div>{children}</div>
    );

  return (
    <section className="mt-6 relative">
      <div className="relative overflow-hidden rounded-3xl border-gold shadow-card bg-dark-gradient aspect-[16/6] md:aspect-[16/5]">
        {banners.map((b, idx) => (
          <div
            key={b.id}
            className={`absolute inset-0 transition-opacity duration-700 ${idx === i ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            {b.link_url ? (
              <a href={b.link_url} target="_blank" rel="noreferrer" className="block size-full">
                <img src={b.image_url} alt={b.title ?? "banner"} className="size-full object-cover" loading="lazy" />
              </a>
            ) : (
              <img src={b.image_url} alt={b.title ?? "banner"} className="size-full object-cover" loading="lazy" />
            )}
            {b.title && (
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <p className="text-gold-soft font-extrabold text-base md:text-lg">{b.title}</p>
              </div>
            )}
          </div>
        ))}

        {banners.length > 1 && (
          <>
            <button
              onClick={() => setI((v) => (v - 1 + banners.length) % banners.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 grid place-items-center size-9 rounded-full bg-black/50 border border-gold/40 text-gold hover:bg-black/70"
              aria-label="prev"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => setI((v) => (v + 1) % banners.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center size-9 rounded-full bg-black/50 border border-gold/40 text-gold hover:bg-black/70"
              aria-label="next"
            >
              <ChevronRight className="size-5" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {banners.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setI(idx)}
                  className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-gold" : "w-2 bg-white/40"}`}
                  aria-label={`go to ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <Wrap>{null}</Wrap>
    </section>
  );
}
