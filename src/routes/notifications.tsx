import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Bell, ShoppingCart, Wallet, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyNotifications } from "@/lib/notifications.functions";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الإشعارات — Lion Store" },
      { name: "description", content: "تابع آخر إشعاراتك وتحديثات الطلبات والشحن في حسابك على ليون ستور." },
      { property: "og:url", content: "https://lions-stores.com/notifications" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://lions-stores.com/notifications" }],
  }),
  beforeLoad: async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const { redirect } = await import("@tanstack/react-router");
      throw redirect({ to: "/login" });
    }
  },
  component: Notifications,
});

function Notifications() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fetchNotifications = useServerFn(getMyNotifications);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login", replace: true });
    }
  }, [authLoading, user, navigate]);

  const { data: items, isLoading } = useQuery({
    queryKey: ["my-notifications", user?.id],
    queryFn: () => fetchNotifications(),
    enabled: !!user,
  });

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto" dir="rtl">
        <h1 className="text-2xl font-bold gold-gradient-text mb-6">الإشعارات</h1>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-4 rounded-2xl bg-card/50 border border-border animate-pulse h-20" />
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-card/50 border border-border">
            <Bell className="size-10 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-lg font-bold">لا توجد إشعارات حاليًا</h2>
            <p className="text-sm text-muted-foreground mt-1">ستظهر هنا تحديثات طلباتك وعمليات الشحن.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((n) => {
              const Icon = n.type === "order" ? ShoppingCart : Wallet;
              const StatusIcon = n.status === "pending" ? Clock : n.status === "completed" || n.status === "approved" ? CheckCircle2 : XCircle;
              const statusColor = n.status === "pending" ? "text-gold" : n.status === "completed" || n.status === "approved" ? "text-emerald-400" : "text-destructive";
              return (
                <div key={n.id} className="flex items-start gap-4 p-4 rounded-2xl bg-card/70 border border-border hover:border-gold/50 transition">
                  <div className="grid place-items-center size-11 rounded-xl bg-gold-gradient text-primary-foreground shrink-0">
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="font-extrabold">{n.title}</h3>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(n.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusIcon className={`size-4 ${statusColor}`} />
                      <p className="text-sm text-muted-foreground">{n.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
