import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAccount } from "@/lib/account.functions";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { User, Mail, Phone, Wallet, Shield, Copy, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الملف الشخصي — Lion Store" },
      { name: "description", content: "عرض بيانات حسابك في ليون ستور والرصيد والطلبات." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://lions-stores.com/profile" }],
  }),
  beforeLoad: async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const { redirect } = await import("@tanstack/react-router");
      throw redirect({ to: "/login" });
    }
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const getAccount = useServerFn(getMyAccount);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login", replace: true });
    }
  }, [authLoading, user, navigate]);

  const account = useQuery({
    queryKey: ["account", user?.id],
    queryFn: () => getAccount(),
    enabled: !!user,
  });

  const profile = account.data?.profile;
  const balance = Number(account.data?.balance ?? 0);
  const isAdmin = account.data?.isAdmin ?? false;
  const isSuperAdmin = account.data?.isSuperAdmin ?? false;

  const copyId = () => {
    if (profile?.custom_id) {
      navigator.clipboard.writeText(profile.custom_id);
      toast.success("تم نسخ الرقم التعريفي");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto" dir="rtl">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="text-muted-foreground hover:text-gold transition-colors">
            <ArrowRight className="size-5" />
          </Link>
          <h1 className="text-2xl font-bold gold-gradient-text">الملف الشخصي</h1>
        </div>

        <div className="bg-card/80 border border-border rounded-2xl p-6 shadow-lg">
          {/* Avatar + name */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
            <div className="size-16 rounded-full bg-gold-gradient grid place-items-center shrink-0">
              <User className="size-8 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{profile?.full_name || user?.user_metadata?.full_name || "المستخدم"}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">رقم التعريف:</span>
                <span className="text-sm font-mono font-bold text-gold">{profile?.custom_id || "—"}</span>
                <button
                  onClick={copyId}
                  className="text-muted-foreground hover:text-gold transition-colors"
                  aria-label="نسخ الرقم التعريفي"
                >
                  <Copy className="size-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {isSuperAdmin ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
                    <Shield className="size-3" /> Super Admin
                  </span>
                ) : isAdmin ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold bg-gold/20 text-gold px-2 py-1 rounded-full">
                    <Shield className="size-3" /> Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold bg-secondary text-muted-foreground px-2 py-1 rounded-full">
                    <User className="size-3" /> مستخدم
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Info rows */}
          <div className="space-y-4">
            <InfoRow icon={Mail} label="البريد الإلكتروني" value={profile?.email || user?.email || "—"} />
            <InfoRow icon={Phone} label="رقم الهاتف" value={profile?.phone || "—"} />
            <InfoRow
              icon={CreditCard}
              label="رقم الحساب"
              value={user?.id ? `${user.id.slice(0, 8)}...${user.id.slice(-8)}` : "—"}
            />
          </div>

          {/* Balance card */}
          <div className="mt-6 pt-6 border-t border-border">
            <div className="bg-gradient-to-l from-gold-deep/20 to-gold/10 border border-gold/30 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-gold/20 grid place-items-center">
                  <Wallet className="size-5 text-gold" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">رصيد المحفظة</p>
                  <p className="text-xl font-bold text-gold">EG {balance.toLocaleString()}</p>
                </div>
              </div>
              <Link
                to="/topup"
                className="rounded-full bg-gold-gradient text-primary-foreground px-4 py-2 text-sm font-bold hover:opacity-90 transition-opacity"
              >
                شحن الآن
              </Link>
            </div>
          </div>

          {/* Quick links */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link
              to="/transactions"
              className="rounded-xl bg-secondary/60 border border-border p-4 text-center hover:border-gold/40 transition-colors"
            >
              <p className="text-sm font-bold">المعاملات</p>
              <p className="text-xs text-muted-foreground mt-1">سجل الشحن والشراء</p>
            </Link>
            <Link
              to="/notifications"
              className="rounded-xl bg-secondary/60 border border-border p-4 text-center hover:border-gold/40 transition-colors"
            >
              <p className="text-sm font-bold">الإشعارات</p>
              <p className="text-xs text-muted-foreground mt-1">تنبيهاتك وآخر التحديثات</p>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="size-9 rounded-lg bg-secondary/70 grid place-items-center shrink-0">
        <Icon className="size-4 text-gold" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold break-words">{value}</p>
      </div>
    </div>
  );
}
