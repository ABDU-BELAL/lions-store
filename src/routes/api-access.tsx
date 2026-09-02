import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPartnerKey, createMyPartnerKey } from "@/lib/partner-account.functions";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export const Route = createFileRoute("/api-access")({
  component: ApiAccessPage,
});

function ApiAccessPage() {
  const { user, loading } = useAuth();
  const getKey = useServerFn(getMyPartnerKey);
  const create = useServerFn(createMyPartnerKey);
  const qc = useQueryClient();
  const [newKey, setNewKey] = useState<string | null>(null);

  if (!loading && !user) throw redirect({ to: "/login" });

  const keyInfo = useQuery({
    queryKey: ["my-partner-key"],
    queryFn: () => getKey(),
    enabled: !!user,
  });

  const mCreate = useMutation({
    mutationFn: () => create(),
    onSuccess: (r: { apiKey: string }) => {
      setNewKey(r.apiKey);
      toast.success("تم إنشاء المفتاح");
      qc.invalidateQueries({ queryKey: ["my-partner-key"] });
    },
    onError: (e: Error) => toast.error(e.message),
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

  const info = keyInfo.data;

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
              لا يمكن استرجاع المفتاح إذا فقدته — احتفظ بنسخة آمنة منه. لحذف هذا المفتاح أو إنشاء مفتاح جديد بدلاً منه، تواصل مع الدعم.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-card/70 border border-border p-5 text-center text-muted-foreground">
              لا يوجد مفتاح بعد. يمكنك إنشاء مفتاح واحد فقط — احتفظ به جيدًا.
            </div>
            <button
              disabled={mCreate.isPending}
              onClick={() => mCreate.mutate()}
              className="w-full rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 disabled:opacity-50"
            >
              {mCreate.isPending ? "..." : "إنشاء مفتاح API"}
            </button>
          </div>
        )}

        {newKey && (
          <div className="mt-5 rounded-xl border border-gold/50 bg-secondary/60 p-4 space-y-2">
            <p className="text-xs font-bold text-gold">انسخ المفتاح الآن — لن يظهر مرة أخرى</p>
            <code className="block break-all text-xs bg-background/70 rounded-lg p-2">{newKey}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(newKey); toast.success("تم النسخ"); }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold"
            >
              نسخ
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
