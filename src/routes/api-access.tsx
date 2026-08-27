import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { KeyRound, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyApiKeys } from "@/lib/partner.functions";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/api-access")({
  head: () => ({
    meta: [
      { title: "My API Access — Lion Store" },
      { name: "description", content: "Partner API access for Lion Store resellers: keys, status and endpoints." },
      { property: "og:title", content: "My API Access — Lion Store" },
      { property: "og:description", content: "Partner API access for Lion Store resellers." },
    ],
  }),
  component: ApiAccess,
});

function ApiAccess() {
  const { t } = useLang();
  const { user } = useAuth();
  const fetchKeys = useServerFn(getMyApiKeys);
  const q = useQuery({
    queryKey: ["my-api-keys", user?.id],
    queryFn: () => fetchKeys(),
    enabled: !!user,
  });

  return (
    <AppLayout>
      <h1 className="text-2xl font-black text-gold-gradient">{t("واجهة الـ API الخاصة بي", "My API access")}</h1>

      {!user && (
        <p className="mt-4 text-muted-foreground">
          {t("سجّل الدخول أولًا.", "Please sign in first.")}{" "}
          <Link to="/login" className="text-gold font-bold">{t("دخول", "Sign in")}</Link>
        </p>
      )}

      {user && q.isLoading && <p className="mt-4 text-muted-foreground">{t("جارٍ التحميل…", "Loading…")}</p>}

      {user && q.data && !q.data.isPartner && (
        <div className="mt-4 rounded-2xl border border-border bg-card/70 p-6 text-center">
          <Lock className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-bold">{t("هذه الصفحة لشركاء الـ API فقط.", "This page is for API partners only.")}</p>
          <a href="https://wa.me/201010594146?text=API" target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex rounded-xl bg-gold-gradient text-primary-foreground px-4 py-2 font-bold">
            {t("اطلب الانضمام كشريك", "Request partner access")}
          </a>
        </div>
      )}

      {user && q.data?.isPartner && (
        <div className="mt-4 grid gap-3">
          {q.data.keys.length === 0 && (
            <p className="text-muted-foreground">{t("لا توجد مفاتيح بعد. تواصل مع الدعم.", "No keys yet. Contact support.")}</p>
          )}
          {q.data.keys.map((key) => {
            return (
              <div key={key.id} className="rounded-2xl border border-border bg-card/70 p-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="size-4 text-gold" />
                  <p className="font-extrabold">{key.label || t("مفتاح API", "API key")}</p>
                  <span className={`ms-auto rounded-full px-2 py-0.5 text-xs font-bold ${key.active ? "bg-emerald-500/15 text-emerald-400" : "bg-destructive/15 text-destructive"}`}>
                    {key.active ? t("مُفعّل", "Active") : t("موقوف", "Disabled")}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground" dir="ltr">
                  Created: {new Date(key.created_at).toLocaleString()}
                  {key.last_used_at ? ` • Last used: ${new Date(key.last_used_at).toLocaleString()}` : ""}
                </p>
              </div>
            );
          })}

          <div className="rounded-2xl border border-border bg-card/70 p-4 text-sm">
            <p className="font-extrabold">{t("نقاط النهاية", "Endpoints")}</p>
            <pre dir="ltr" className="mt-2 overflow-x-auto text-xs text-muted-foreground">{`GET  /api/partner/products
POST /api/partner/order
GET  /api/partner/order/{id}

Header: Authorization: Bearer <your-api-key>`}</pre>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("المفتاح يُعرض مرة واحدة فقط عند إنشائه. لو فقدته تواصل مع الدعم لإصدار مفتاح جديد.",
                "Your key is shown only once at creation. If you lost it, contact support to reissue.")}
            </p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
