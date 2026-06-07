import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { ProductCard } from "@/components/ProductCard";
import { BannerSlideshow } from "@/components/BannerSlideshow";
import { listShopProducts } from "@/lib/shop.functions";
import { listActiveCollections, getHomeSettings } from "@/lib/collections.functions";
import logo from "@/assets/logo.jpeg.asset.json";
import { ShoppingBag, LayoutGrid, CreditCard, Tag, Headphones, Zap, ShieldCheck, BadgePercent, Gamepad2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lion Store — الرئيسية" },
      { name: "description", content: "ليون ستور: شحن ألعاب وتطبيقات بأمان وأفضل الأسعار في السوق." },
    ],
  }),
  component: Home,
});

const navTiles: { to: "/shop" | "/categories" | "/payments"; label: string; icon: typeof ShoppingBag; active?: boolean }[] = [
  { to: "/shop", label: "المتجر", icon: ShoppingBag, active: true },
  { to: "/categories", label: "الأقسام", icon: LayoutGrid },
  { to: "/payments", label: "طرق الدفع", icon: CreditCard },
];

const features = [
  { icon: Headphones, title: "دعم فني متواصل", desc: "خدمة عملاء على مدار الساعة" },
  { icon: Zap, title: "أسرع شحن", desc: "توصيل فوري خلال ثوانٍ" },
  { icon: BadgePercent, title: "أسعار منافسة", desc: "أفضل الأسعار في السوق" },
  { icon: ShieldCheck, title: "أمان وحماية", desc: "معاملات آمنة 100%" },
];

function Home() {
  const fetchProducts = useServerFn(listShopProducts);
  const fetchCollections = useServerFn(listActiveCollections);
  const fetchSettings = useServerFn(getHomeSettings);

  const { data: products = [] } = useQuery({ queryKey: ["home-products"], queryFn: () => fetchProducts() });
  const { data: collections = [] } = useQuery({ queryKey: ["home-collections"], queryFn: () => fetchCollections() });
  const { data: settings } = useQuery({ queryKey: ["home-settings"], queryFn: () => fetchSettings() });

  const featured = products.filter((p) => !p.is_offer).slice(0, 8);
  const offerItems = products.filter((p) => p.is_offer).slice(0, 8);
  const homeCollections = collections.filter((c) => c.show_on_home);

  const showFeatured = settings?.show_featured ?? true;
  const showOffers = settings?.show_offers ?? true;
  const showCollections = settings?.show_collections ?? true;

  return (
    <AppLayout>
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-dark-gradient border-gold shadow-card p-6 md:p-10">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_50%_50%,_oklch(0.7_0.18_75_/_50%),_transparent_60%)]" />
        <div className="relative grid md:grid-cols-2 gap-6 items-center">
          <div className="text-right">
            <h1 className="text-4xl md:text-6xl font-black text-gold-gradient leading-tight">LION STORE</h1>
            <p className="mt-3 text-lg md:text-xl font-bold text-gold-soft">ملك الشحن — أفضل الأسعار</p>
            <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-md md:mr-0 mr-auto">
              أمانك يهمنا. تأكد دائمًا من التواصل عبر أرقامنا الرسمية وتجنب أي وسيط أو مصادر غير موثوقة.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/shop" className="rounded-full bg-gold-gradient text-primary-foreground font-extrabold px-6 py-2.5 shadow-gold">تسوق الآن</Link>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="relative size-48 md:size-64">
              <div className="absolute inset-0 rounded-full bg-gold-gradient opacity-25 blur-2xl animate-pulse" />
              <img src={logo.url} alt="Lion Store" className="relative rounded-full size-full object-cover ring-4 ring-gold/40 shadow-gold" />
            </div>
          </div>
        </div>
      </section>

      <BannerSlideshow />

      {/* Top nav tiles */}
      <section className="mt-6 grid grid-cols-3 gap-3">
        {navTiles.map((c) => (
          <Link key={c.label} to={c.to} className={`group flex flex-col items-center justify-center gap-2 rounded-2xl border ${c.active ? "border-gold/60 bg-gradient-to-b from-gold/20 to-card" : "border-border bg-card/60"} p-4 hover:border-gold/60 transition`}>
            <div className={`grid place-items-center size-10 rounded-xl ${c.active ? "bg-gold-gradient text-primary-foreground" : "bg-secondary/80 text-gold"}`}><c.icon className="size-5" /></div>
            <span className="text-xs md:text-sm font-bold text-center">{c.label}</span>
          </Link>
        ))}
      </section>

      {/* Admin-managed collections */}
      {showCollections && homeCollections.length > 0 && (
        <>
          <div className="mt-8 flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-extrabold text-gold-gradient flex items-center gap-2">
              <Gamepad2 className="size-5 text-gold" /> الأقسام
            </h2>
            <Link to="/categories" className="text-sm text-gold hover:underline">عرض الكل</Link>
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {homeCollections.map((c) => (
              <Link key={c.id} to="/collection/$slug" params={{ slug: c.slug }} className="group rounded-2xl overflow-hidden bg-dark-gradient border border-gold/30 hover:border-gold/70 hover:shadow-gold transition">
                <div className="aspect-square bg-secondary/40 grid place-items-center overflow-hidden">
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <Tag className="size-12 text-gold opacity-60" />
                  )}
                </div>
                <p className="font-extrabold text-center p-3 text-gold-gradient">{c.title}</p>
              </Link>
            ))}
          </div>
        </>
      )}

      {showFeatured && featured.length > 0 && (
        <>
          <div className="mt-8 flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-extrabold text-gold-gradient flex items-center gap-2">
              <Gamepad2 className="size-5 text-gold" /> الألعاب والتطبيقات
            </h2>
            <Link to="/shop" className="text-sm text-gold hover:underline">عرض الكل</Link>
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {featured.map((p) => (
              <ProductCard key={p.id} title={p.title} image={p.image_url || logo.url} to="/shop" search={{ q: p.title }} />
            ))}
          </div>
        </>
      )}

      {showOffers && offerItems.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-extrabold text-gold-gradient flex items-center gap-2"><Tag className="size-5 text-gold" /> أبرز العروض</h2>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {offerItems.map((o) => (
              <ProductCard key={o.id} title={o.title} image={o.image_url || logo.url} to="/shop" search={{ q: o.title }} />
            ))}
          </div>
        </div>
      )}

      <section className="mt-10 rounded-3xl border border-border bg-card/60 p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        {features.map((f) => (
          <div key={f.title} className="flex items-center gap-3">
            <div className="grid place-items-center size-11 rounded-xl bg-gold-gradient text-primary-foreground shrink-0"><f.icon className="size-5" /></div>
            <div>
              <p className="font-bold text-sm">{f.title}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          </div>
        ))}
      </section>
    </AppLayout>
  );
}
