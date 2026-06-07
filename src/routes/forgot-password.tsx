import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.jpeg.asset.json";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "نسيت كلمة السر — Lion Store" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("تم إرسال رابط الاستعادة إلى بريدك");
  };

  return (
    <div dir="rtl" className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-dark-gradient border-gold shadow-card p-8 text-right">
        <div className="text-center mb-6">
          <img src={logo.url} alt="Lion Store" className="mx-auto size-20 rounded-full ring-2 ring-gold/40" />
          <h1 className="mt-4 text-2xl font-black text-gold-gradient">نسيت كلمة السر؟</h1>
          <p className="text-sm text-muted-foreground mt-1">أدخل بريدك وسنرسل لك رابط الاستعادة</p>
        </div>

        {sent ? (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center text-emerald-300">
            تحقق من بريدك الإلكتروني واتبع الرابط لتعيين كلمة سر جديدة.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs font-bold mb-1 block">الإيميل</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold/50"
              />
            </div>
            <button disabled={loading} className="w-full rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold disabled:opacity-50">
              {loading ? "جارٍ الإرسال..." : "إرسال رابط الاستعادة"}
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-center text-muted-foreground">
          <Link to="/login" className="text-gold font-bold">العودة لتسجيل الدخول</Link>
        </p>
      </div>
    </div>
  );
}
