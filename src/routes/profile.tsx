import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAccount } from "@/lib/account.functions";
import { getMyVip, listVipTiers } from "@/lib/vip.functions";
import { VipBadge } from "@/components/VipBadge";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { User, Mail, Phone, Wallet, Shield, Copy, ArrowRight, ArrowLeft, Crown } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { useCurrency, type Currency } from "@/i18n/CurrencyProvider";
import { DollarSign } from "lucide-react";

export const Route = createFileRoute("/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Profile — Lion Store / الملف الشخصي" },
      { name: "description", content: "Your Lion Store account information." },
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
  const getVip = useServerFn(getMyVip);
  const getTiers = useServerFn(listVipTiers);
  const { t, lang, dir } = useLang();
  const { currency, setCurrency, rate, format } = useCurrency();

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/login", replace: true }); }, [authLoading, user, navigate]);

  const account = useQuery({ queryKey: ["account", user?.id], queryFn: () => getAccount(), enabled: !!user });
  const vip = useQuery({ queryKey: ["my-vip", user?.id], queryFn: () => getVip(), enabled: !!user });
  const tiers = useQuery({ queryKey: ["vip-tiers"], queryFn: () => getTiers(), enabled: !!user });

  const profile = account.data?.profile;
  const balance = Number(account.data?.balance ?? 0);
  const isAdmin = account.data?.isAdmin ?? false;
  const isSuperAdmin = account.data?.isSuperAdmin ?? false;

  const copyId = () => {
    if (profile?.custom_id) {
      navigator.clipboard.writeText(profile.custom_id);
      toast.success(t("تم نسخ الرقم التعريفي", "ID copied"));
    }
  };

  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto" dir={dir}>
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="text-muted-foreground hover:text-gold transition-colors">
            <BackArrow className="size-5" />
          </Link>
          <h1 className="text-2xl font-bold gold-gradient-text">{t("الملف الشخصي", "Profile")}</h1>
        </div>

        <div className="bg-card/80 border border-border rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
            <div className="size-16 rounded-full bg-gold-gradient grid place-items-center shrink-0">
              <User className="size-8 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{profile?.full_name || user?.user_metadata?.full_name || t("المستخدم", "User")}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">{t("رقم التعريف:", "User ID:")}</span>
                <span className="text-sm font-mono font-bold text-gold">{profile?.custom_id || "—"}</span>
                <button onClick={copyId} className="text-muted-foreground hover:text-gold transition-colors" aria-label={t("نسخ الرقم التعريفي", "Copy ID")}>
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
                    <User className="size-3" /> {t("مستخدم", "User")}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <InfoRow icon={Mail} label={t("البريد الإلكتروني", "Email")} value={profile?.email || user?.email || "—"} />
            <InfoRow icon={Phone} label={t("رقم الهاتف", "Phone number")} value={profile?.phone || "—"} />
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-center justify-between bg-secondary/40 border border-border rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-gold/20 grid place-items-center">
                  <DollarSign className="size-5 text-gold" />
                </div>
                <div>
                  <p className="text-sm font-bold">{t("عرض الأسعار", "Display currency")}</p>
                  <p className="text-xs text-muted-foreground">
                    {rate
                      ? t(`1 USD ≈ ${rate.toFixed(2)} EGP`, `1 USD ≈ ${rate.toFixed(2)} EGP`)
                      : t("جارٍ تحميل سعر الصرف...", "Loading rate...")}
                  </p>
                </div>
              </div>
              <div className="inline-flex rounded-full bg-background border border-border p-1">
                {(["EGP", "USD"] as Currency[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${currency === c ? "bg-gold-gradient text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-l from-gold-deep/20 to-gold/10 border border-gold/30 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-gold/20 grid place-items-center">
                  <Wallet className="size-5 text-gold" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("رصيد المحفظة", "Wallet balance")}</p>
                  <p className="text-xl font-bold text-gold">{format(balance)}</p>
                </div>
              </div>
              <Link to="/topup" className="rounded-full bg-gold-gradient text-primary-foreground px-4 py-2 text-sm font-bold hover:opacity-90 transition-opacity">
                {t("شحن الآن", "Top up now")}
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link to="/transactions" className="rounded-xl bg-secondary/60 border border-border p-4 text-center hover:border-gold/40 transition-colors">
              <p className="text-sm font-bold">{t("المعاملات", "Transactions")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("سجل الشحن والشراء", "Top-up and purchase history")}</p>
            </Link>
            <Link to="/notifications" className="rounded-xl bg-secondary/60 border border-border p-4 text-center hover:border-gold/40 transition-colors">
              <p className="text-sm font-bold">{t("الإشعارات", "Notifications")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("تنبيهاتك وآخر التحديثات", "Your alerts and latest updates")}</p>
            </Link>
          </div>
        </div>

        {/* VIP Section */}
        <VipSection
          level={vip.data?.level ?? 0}
          lifetimeSpend={vip.data?.lifetimeSpend ?? 0}
          manual={!!vip.data?.manuallyAssigned}
          tiers={tiers.data ?? []}
          lang={lang}
          t={t}
          format={format}
        />
      </div>
    </AppLayout>
  );
}

type Tier = { level: number; name_ar: string; name_en: string; discount_percent: number | string; spend_threshold: number | string; color_hex: string; accent_hex: string };

function VipSection({ level, lifetimeSpend, manual, tiers, lang, t, format }: {
  level: number; lifetimeSpend: number; manual: boolean;
  tiers: Tier[]; lang: string; t: (a: string, b: string) => string; format: (n: number) => string;
}) {
  const current = tiers.find((x) => x.level === level);
  const next = tiers.find((x) => x.level === level + 1);
  const currentThreshold = current ? Number(current.spend_threshold) : 0;
  const nextThreshold = next ? Number(next.spend_threshold) : null;
  const progress = nextThreshold && nextThreshold > currentThreshold
    ? Math.min(100, Math.max(0, ((lifetimeSpend - currentThreshold) / (nextThreshold - currentThreshold)) * 100))
    : 100;
  const remaining = nextThreshold ? Math.max(0, nextThreshold - lifetimeSpend) : 0;

  return (
    <div className="mt-6 bg-card/80 border border-gold/30 rounded-2xl p-6 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <Crown className="size-5 text-gold" />
        <h2 className="text-lg font-extrabold text-gold-gradient">{t("مستوى VIP", "VIP Status")}</h2>
        {manual && (
          <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
            {t("ممنوح يدوياً", "Admin granted")}
          </span>
        )}
      </div>

      {/* Current badge + progress */}
      <div className="flex items-center gap-5 mb-5">
        <VipBadge level={level || 1} color={current?.color_hex} accent={current?.accent_hex} current={level > 0} locked={level === 0} size={104} />
        <div className="flex-1 min-w-0">
          <p className="text-xl font-black text-gold-gradient">
            {level > 0 ? `LV ${level} — ${lang === "ar" ? (current?.name_ar ?? "") : (current?.name_en ?? "")}` : t("بدون مستوى", "No tier yet")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("إجمالي إنفاقك", "Lifetime spend")}: <span className="font-bold text-foreground">{format(lifetimeSpend)}</span>
          </p>
          {current && Number(current.discount_percent) > 0 && (
            <p className="text-xs text-gold mt-0.5">
              {t("خصم ثابت", "Permanent discount")}: <span className="font-extrabold">{Number(current.discount_percent).toFixed(1)}%</span>
            </p>
          )}

          {nextThreshold !== null && !manual && (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-gold-gradient transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t("للوصول إلى", "To reach")} LV {(next as Tier).level}: {format(remaining)} {t("متبقي", "remaining")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 20-level gallery */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-bold text-gold hover:text-gold-deep">
          {t("عرض كل المستويات (20)", "Show all 20 tiers")}
        </summary>
        <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 gap-3">
          {tiers.map((tr) => {
            const locked = tr.level > level;
            const isCurrent = tr.level === level;
            return (
              <div key={tr.level} className={`rounded-xl border p-2 text-center ${isCurrent ? "border-gold bg-gold/10" : "border-border bg-secondary/30"}`}>
                <div className="flex justify-center">
                  <VipBadge level={tr.level} color={tr.color_hex} accent={tr.accent_hex} locked={locked} current={isCurrent} size={56} />
                </div>
                <p className="mt-1 text-[11px] font-bold truncate">{lang === "ar" ? tr.name_ar : tr.name_en}</p>
                <p className="text-[10px] text-muted-foreground">{Number(tr.discount_percent).toFixed(1)}%</p>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
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
