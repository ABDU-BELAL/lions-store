import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPartnerKey } from "@/lib/partner-account.functions";
import { KeyRound, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/api-access")({
  component: ApiAccessPage,
});

function ApiAccessPage() {
  const { user, loading } = useAuth();
  const getKey = useServerFn(getMyPartnerKey);

  if (!loading && !user) throw redirect({ to: "/login" });

  const keyInfo = useQuery({
    queryKey: ["my-partner-key"],
    queryFn: () => getKey(),
    enabled: !!user,
  });

  if (loading || keyInfo.isLoading) {
    return <AppLayout><p className="text-center py-12 text-muted-foreground">جاري التحميل...</p></AppLayout>;
  }

  if (keyInfo.isError) {
    return (
      <AppLayout>
        <div className="rounded-3xl bg-dark-gradient border-gold p-8 text-center max-w-lg mx-auto">
          <p className="text-muted-foreground">ليس لديك صلاحية الوصول لهذه الصفحة.</p>
        </div>
      </AppLayout>
    );
  }

  const info = keyInfo.data as (typeof keyInfo.data & { visible_key?: string | null }) | null;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="grid place-items-center size-12 rounded-2xl bg-gold-gradient text-primary-foreground"><KeyRound className="size-6" /></div>
          <div>
            <h1 className="text-2xl font-black text-gold-gradient">مفتاح API الخاص بي</h1>
            <p className="text-xs text-muted-foreground">إدارة مفتاح الوصول البرمجي لحسابك</p>
          </div>
        </div>

        {info ? (
          <div className="rounded-2xl bg-card/70 border border-border p-5 space-y-3">
            {info.visible_key && (
              <div>
                <span className="text-sm text-muted-foreground block mb-1">المفتاح</span>
                <div className="flex items-center gap-2 rounded-lg bg-background/60 border border-border px-3 py-2">
                  <code className="flex-1 text-xs break-all" dir="ltr">{info.visible_key}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(info.visible_key!); toast.success("تم النسخ"); }}
                    className="shrink-0"
                  >
                    <Copy className="size-4 text-gold" />
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">بادئة المفتاح</span>
              <code className="text-sm font-mono">{info.key_prefix}...</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">الحالة</span>
              <span className={`text-xs font-bold rounded-full px-3 py-1 ${info.active ? "bg-emerald-500/15 text-emerald-400" : "bg-destructive/15 text-destructive"}`}>
                {info.active ? "مفعل" : "معطل"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">تاريخ الإنشاء</span>
              <span className="text-sm">{new Date(info.created_at).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">آخر استخدام</span>
              <span className="text-sm">{info.last_used_at ? new Date(info.last_used_at).toLocaleString() : "—"}</span>
            </div>
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              لأي استفسار حول مفتاحك، تواصل مع الدعم.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-card/70 border border-border p-5 text-center text-muted-foreground">
            لا يوجد مفتاح API لحسابك بعد. تواصل مع الدعم لإنشاء مفتاح.
          </div>
        )}
      </div>
    </AppLayout>
  );
}
