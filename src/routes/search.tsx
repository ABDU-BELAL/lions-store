import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ProductCard } from "@/components/ProductCard";
import { games, apps } from "@/lib/products";
import { Search as SearchIcon } from "lucide-react";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "بحث — Lion Store" }] }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const all = useMemo(() => [...games, ...apps], []);
  const results = q ? all.filter((p) => p.title.includes(q)) : all;

  return (
    <AppLayout>
      <h1 className="text-3xl font-black text-gold-gradient mb-5">بحث</h1>
      <div className="relative">
        <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 size-5 text-gold" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن لعبة أو تطبيق..." className="w-full rounded-full bg-secondary/60 border-gold pr-12 pl-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-gold/50" autoFocus />
      </div>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {results.map((p) => <ProductCard key={p.id} title={p.title} image={p.image} />)}
        {results.length === 0 && <p className="col-span-full text-center text-muted-foreground py-12">لا توجد نتائج</p>}
      </div>
    </AppLayout>
  );
}
