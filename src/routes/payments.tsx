import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Phone, Building2, Bitcoin } from "lucide-react";

export const Route = createFileRoute("/payments")({
  head: () => ({ meta: [{ title: "طرق الدفع — Lion Store" }] }),
  component: Payments,
});

const methods = [
  { icon: Phone, name: "فودافون كاش", desc: "01040483540" },
  { icon: Building2, name: "إنستا باي", desc: "islam20304050@instapay" },
  { icon: Building2, name: "إنستا باي (رقم)", desc: "01040483540" },
  { icon: Bitcoin, name: "USDT (TRC20)", desc: "TS3NudYfcXA3cUBqZmMUFPpidZRdFG86PD" },
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
          <div key={m.name + m.desc} className="flex items-center gap-4 p-5 rounded-2xl bg-card/70 border border-border hover:border-gold/50 transition">
            <div className="grid place-items-center size-14 rounded-xl bg-gold-gradient text-primary-foreground shrink-0">
              <m.icon className="size-7" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold">{m.name}</h3>
              <p dir="ltr" className="text-sm text-muted-foreground text-right break-all">{m.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
