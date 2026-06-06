import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Gamepad2, Smartphone, Tag, CreditCard, Headphones, Trophy } from "lucide-react";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "الأقسام — Lion Store" }] }),
  component: Categories,
});

const cats = [
  { to: "/games", label: "شحن الألعاب", icon: Gamepad2 },
  { to: "/apps", label: "شحن التطبيقات", icon: Smartphone },
  { to: "/offers", label: "العروض", icon: Tag },
  { to: "/payments", label: "طرق الدفع", icon: CreditCard },
  { to: "/about", label: "الدعم الفني", icon: Headphones },
  { to: "/offers", label: "بطولات", icon: Trophy },
] as const;

function Categories() {
  return (
    <AppLayout>
      <h1 className="text-3xl font-black text-gold-gradient mb-6">الأقسام</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {cats.map((c) => (
          <Link key={c.label} to={c.to} className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card/70 border border-border hover:border-gold/60 hover:shadow-gold transition">
            <div className="grid place-items-center size-14 rounded-2xl bg-gold-gradient text-primary-foreground"><c.icon className="size-7" /></div>
            <span className="font-extrabold text-center">{c.label}</span>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
