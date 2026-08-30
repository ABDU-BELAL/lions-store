import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { KeyRound, Lock, Copy, Check, Eye, EyeOff, RefreshCw, Ban } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyApiKeys, revealMyApiKey, generateMyApiKey, revokeMyApiKey } from "@/lib/partner.functions";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageProvider";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/api-access")({
  head: () => ({
    meta: [
      { title: "My API Access — Lion Store" },
      { name: "description", content: "Partner API access for Lion Store resellers: keys, token and endpoints." },
      { property: "og:title", content: "My API Access — Lion Store" },
      { property: "og:description", content: "Partner API access for Lion Store resellers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApiAccess,
});

function SecretField({ label, value, masked }: { label: string; value: string | null; masked?: boolean }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const { t } = useLang();

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(t("تم النسخ", "Copied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("تعذّر النسخ", "Copy failed"));
    }
  };

  const display = !value
    ? "—"
    : shown
      ? value
      : masked === false
        ? value
        : "•".repeat(Math.min(40, Math.max(12, value.length)));

  return (
    <div className="mt-3">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2">
        <code dir="ltr" className="flex-1 overflow-x-auto whitespace-nowrap text-xs">{display}</code>
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? t("إخفاء", "Hide") : t("إظهار", "Reveal")}
          className="rounded-lg p-1.5 hover:bg-muted"
          disabled={!value}
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
        <button
          type="button"
          onClick={copy}
          aria-label={t("نسخ", "Copy")}
          className="rounded-lg p-1.5 hover:bg-muted"
          disabled={!value}
        >
          {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function ApiAccess() {
  const { t } = useLang();
  const { user } = useAuth();
  const fetchKeys = useServerFn(getMyApiKeys);
  const reveal = useServerFn(revealMyApiKey);
  const generate = useServerFn(generateMyApiKey);
  const revoke = useServerFn(revokeMyApiKey);

  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["my-api-keys", user?.id],
    queryFn: () => fetchKeys(),
    enabled: !!user,
  });

  const onReveal = async (keyId: string) => {
    setBusy(keyId);
    try {
      const res = await reveal({ data: { keyId } });
      setTokens((prev) => ({ ...prev, [keyId]: res.token }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("حدث خطأ", "Something went wrong"));
    } finally {
      setBusy(null);
    }
  };

  const onGenerate = async () => {
    setBusy("new");
    try {
      const res = await generate({ data: {} });
      setTokens((prev) => ({ ...prev, [res.keyId]: res.token }));
      toast.success(t("تم إنشاء مفتاح جديد", "New key generated"));
      await q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("حدث خطأ", "Something went wrong"));
    } finally {
      setBusy(null);
    }
  };

  const onRevoke = async (keyId: string) => {
    setBusy(keyId);
    try {
      await revoke({ data: { keyId } });
      toast.success(t("تم إيقاف المفتاح", "Key disabled"));
      await q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("حدث خطأ", "Something went wrong"));
    } finally {
      setBusy(null);
    }
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onGenerate}
              disabled={busy === "new"}
              className="rounded-xl bg-gold-gradient text-primary-foreground px-4 py-2 text-sm font-bold disabled:opacity-60"
            >
              <RefreshCw className="me-1 inline size-4" />
              {busy === "new" ? t("جارٍ الإنشاء…", "Generating…") : t("إنشاء مفتاح جديد", "Generate new key")}
            </button>
          </div>

          {q.data.keys.length === 0 && (
            <p className="text-muted-foreground">
              {t("لا توجد مفاتيح بعد. اضغط إنشاء مفتاح جديد.", "No keys yet. Click generate to create one.")}
            </p>
          )}

          {q.data.keys.map((key) => (
            <div key={key.id} className="rounded-2xl border border-border bg-card/70 p-4">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-gold" />
                <p className="font-extrabold">{key.label || t("مفتاح API", "API key")}</p>
                <span className={`ms-auto rounded-full px-2 py-0.5 text-xs font-bold ${key.active ? "bg-emerald-500/15 text-emerald-400" : "bg-destructive/15 text-destructive"}`}>
                  {key.active ? t("مُفعّل", "Active") : t("موقوف", "Disabled")}
                </span>
              </div>

              <SecretField label={t("معرّف الـ API", "API ID")} value={key.id} />
              <SecretField label={t("توكن الـ API", "API token")} value={tokens[key.id] ?? null} />

              {!tokens[key.id] && (
                <button
                  type="button"
                  onClick={() => onReveal(key.id)}
                  disabled={busy === key.id || !key.has_secret}
                  className="mt-2 rounded-xl border border-gold/40 px-3 py-1.5 text-xs font-bold text-gold disabled:opacity-50"
                >
                  {busy === key.id ? t("جارٍ…", "Loading…") : t("إظهار التوكن", "Load token")}
                </button>
              )}
              {!key.has_secret && (
                <p className="mt-2 text-xs text-destructive">
                  {t("هذا المفتاح قديم ولا يمكن إظهاره — أنشئ مفتاحًا جديدًا.",
                    "This key is legacy and can't be revealed — generate a new one.")}
                </p>
              )}

              <p className="mt-3 text-xs text-muted-foreground" dir="ltr">
                Prefix: {key.key_prefix ?? "—"} • Created: {new Date(key.created_at).toLocaleString()}
                {key.last_used_at ? ` • Last used: ${new Date(key.last_used_at).toLocaleString()}` : ""}
              </p>

              {key.active && (
                <button
                  type="button"
                  onClick={() => onRevoke(key.id)}
                  disabled={busy === key.id}
                  className="mt-3 inline-flex items-center gap-1 rounded-xl border border-destructive/40 px-3 py-1.5 text-xs font-bold text-destructive disabled:opacity-50"
                >
                  <Ban className="size-3.5" /> {t("إيقاف المفتاح", "Disable key")}
                </button>
              )}
            </div>
          ))}

          <div className="rounded-2xl border border-border bg-card/70 p-4 text-sm">
            <p className="font-extrabold">{t("نقاط النهاية", "Endpoints")}</p>
            <pre dir="ltr" className="mt-2 overflow-x-auto text-xs text-muted-foreground">{`GET  ${baseUrl}/api/partner/products
POST ${baseUrl}/api/partner/order
GET  ${baseUrl}/api/partner/order/{id}

Header: api-token: <your-api-token>
   (or Authorization: Bearer <your-api-token>)`}</pre>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
