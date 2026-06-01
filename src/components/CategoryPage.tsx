import { AppLayout } from "@/components/AppLayout";
import { ProductCard } from "@/components/ProductCard";

interface Props {
  title: string;
  subtitle?: string;
  items: { id: string; title: string; image: string; badge?: string }[];
}

export function CategoryPage({ title, subtitle, items }: Props) {
  return (
    <AppLayout>
      <div className="rounded-3xl bg-dark-gradient border-gold p-6 md:p-8 text-right shadow-card">
        <h1 className="text-3xl md:text-4xl font-black text-gold-gradient">{title}</h1>
        {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="mt-6 relative">
        <input placeholder="بحث..." className="w-full rounded-full bg-secondary/60 border border-border px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" />
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((p) => <ProductCard key={p.id} title={p.title} image={p.image} badge={p.badge} />)}
      </div>
    </AppLayout>
  );
}
