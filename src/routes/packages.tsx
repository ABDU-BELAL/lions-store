import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Crown, Check } from "lucide-react";

export const Route = createFileRoute("/packages")({
  head: () => ({ meta: [{ title: "الباقات المميزة — Lion Store" }] }),
  component: Packages,
});

const tiers = [
  { name: "البرونزية", price: "EG 99", perks: ["شحن فوري", "دعم أساسي", "خصم 5%"], featured: false },
  { name: "الفضية", price: "EG 249", perks: ["أولوية الشحن", "دعم متقدم", "خصم 10%", "كاش باك أسبوعي"], featured: false },
  { name: "الذهبية", price: "EG 499", perks: ["أولوية قصوى", "مدير حساب خاص", "خصم 20%", "هدايا شهرية", "وصول مبكر للعروض"], featured: true },
];

function Packages() {
  return (
    <AppLayout>
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-5xl font-black text-gold-gradient">الباقات المميزة</h1>
        <p className="mt-3 text-muted-foreground">اختر الباقة الأنسب لك واحصل على امتيازات حصرية</p>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {tiers.map((t) => (
          <div key={t.name} className={`relative rounded-3xl p-6 border ${t.featured ? "border-gold/60 bg-gradient-to-b from-gold/15 to-card shadow-gold" : "border-border bg-card/70"}`}>
            {t.featured && <div className="absolute -top-3 right-6 rounded-full bg-gold-gradient text-primary-foreground text-xs font-extrabold px-3 py-1">الأكثر شيوعًا</div>}
            <div className="flex items-center gap-2">
              <Crown className={`size-6 ${t.featured ? "text-gold" : "text-muted-foreground"}`} />
              <h3 className="text-xl font-extrabold">{t.name}</h3>
            </div>
            <p className="mt-4 text-3xl font-black text-gold-gradient">{t.price}<span className="text-sm text-muted-foreground font-normal"> / شهر</span></p>
            <ul className="mt-5 space-y-2 text-sm">
              {t.perks.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <Check className="size-4 text-gold" /> {p}
                </li>
              ))}
            </ul>
            <button className={`mt-6 w-full rounded-full py-2.5 font-extrabold ${t.featured ? "bg-gold-gradient text-primary-foreground shadow-gold" : "bg-secondary text-foreground"}`}>اشترك الآن</button>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
