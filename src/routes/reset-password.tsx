import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.jpeg.asset.json";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set new password — Lion Store" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const { t, dir } = useLang();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error(t("كلمة السر يجب أن تكون 6 أحرف على الأقل", "Password must be at least 6 characters"));
    if (password !== confirm) return toast.error(t("كلمتا السر غير متطابقتين", "Passwords don't match"));
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(t("تم تحديث كلمة السر", "Password updated"));
    navigate({ to: "/", replace: true });
  };

  return (
    <div dir={dir} className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-dark-gradient border-gold shadow-card p-8">
        <div className="text-center mb-6">
          <img src={logo.url} alt="Lion Store" className="mx-auto size-20 rounded-full ring-2 ring-gold/40" />
          <h1 className="mt-4 text-2xl font-black text-gold-gradient">{t("تعيين كلمة سر جديدة", "Set a new password")}</h1>
        </div>

        {!ready ? (
          <p className="text-center text-muted-foreground">{t("جاري التحقق من الرابط...", "Verifying the link...")}</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs font-bold mb-1 block">{t("كلمة السر الجديدة", "New password")}</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold/50" />
            </div>
            <div>
              <label className="text-xs font-bold mb-1 block">{t("تأكيد كلمة السر", "Confirm password")}</label>
              <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold/50" />
            </div>
            <button disabled={loading} className="w-full rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold disabled:opacity-50">
              {loading ? t("جاري الحفظ...", "Saving...") : t("حفظ كلمة السر", "Save password")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
