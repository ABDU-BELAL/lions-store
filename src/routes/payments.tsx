import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Phone, Building2, Banknote, Bitcoin } from "lucide-react";

export const Route = createFileRoute("/payments")({
  head: () => ({ meta: [{ title: "طرق الدفع — Lion Store" }] }),
  component: Payments,
});

const methods = [
  { icon: Phone, name: "فودافون كاش", desc: "تحويل فوري على 01027923110" },
  { icon: Building2, name: "إنستا باي", desc: "lionstore@instapay" },
  { icon: Banknote, name: "فوري", desc: "كود التاجر متاح في صفحة الشحن" },
  { icon: Bitcoin, name: "Binance (USDT)", desc: "شبكة TRC20" },
];

function Payments() {
  return (
    <AppLayout>
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-5xl font-black text-gold-gradient">طرق الدفع</h1>
        <p className="mt-3 text-muted-foreground">ادفع بالطريقة التي تناسبك — جميع المعاملات آمنة ومشفرة</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {methods.map((m) => (
          <div key={m.name} className="flex items-center gap-4 p-5 rounded-2xl bg-card/70 border border-border hover:border-gold/50 transition">
            <div className="grid place-items-center size-14 rounded-xl bg-gold-gradient text-primary-foreground shrink-0">
              <m.icon className="size-7" />
            </div>
            <div>
              <h3 className="font-extrabold">{m.name}</h3>
              <p className="text-sm text-muted-foreground">{m.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
