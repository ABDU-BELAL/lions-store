import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Bell, Gift, Zap, Tag } from "lucide-react";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "الإشعارات — Lion Store" },
      { name: "description", content: "تابع آخر الإشعارات والعروض وتحديثات الطلبات في حسابك على ليون ستور." },
      { property: "og:url", content: "https://lions-stores.com/notifications" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://lions-stores.com/notifications" }],
  }),
  component: Notifications,
});

const items = [
  { icon: Gift, title: "هدية ترحيبية!", desc: "احصل على خصم 10% على أول طلب لك.", time: "منذ دقيقتين" },
  { icon: Tag, title: "عرض ببجي موبايل", desc: "خصم 20% على جميع شحنات الـUC حتى نهاية الأسبوع.", time: "منذ ساعة" },
  { icon: Zap, title: "تم شحن طلبك", desc: "تم شحن 660 UC إلى حسابك بنجاح.", time: "أمس" },
  { icon: Bell, title: "تحديث الباقات", desc: "أضفنا باقة جديدة لمحبي الألعاب التنافسية.", time: "3 أيام" },
];

function Notifications() {
  return (
    <AppLayout>
      <h1 className="text-3xl font-black text-gold-gradient mb-6">الإشعارات</h1>
      <div className="space-y-3">
        {items.map((n, i) => (
          <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-card/70 border border-border hover:border-gold/50 transition">
            <div className="grid place-items-center size-11 rounded-xl bg-gold-gradient text-primary-foreground shrink-0"><n.icon className="size-5" /></div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-extrabold">{n.title}</h3>
                <span className="text-xs text-muted-foreground">{n.time}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{n.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
