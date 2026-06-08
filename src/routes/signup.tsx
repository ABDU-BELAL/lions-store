import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.jpeg.asset.json";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "إنشاء حساب — Lion Store" },
      { name: "description", content: "أنشئ حسابك في ليون ستور للاستفادة من أسرع شحن للألعاب والتطبيقات وأفضل الأسعار." },
      { property: "og:title", content: "إنشاء حساب — Lion Store" },
      { property: "og:description", content: "انضم لمجتمع ليون ستور وابدأ شحن ألعابك المفضلة." },
      { property: "og:url", content: "https://lions-stores.com/signup" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://lions-stores.com/signup" }],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/", replace: true });
  }, [user, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("كلمة السر 6 حروف على الأقل");
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, phone },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.session) {
      toast.success("تم إنشاء الحساب بنجاح");
      navigate({ to: "/", replace: true });
    } else {
      toast.success("تم إنشاء الحساب! راجع بريدك لتأكيد الإيميل ثم سجل دخول.");
      navigate({ to: "/login" });
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error(result.error.message);
  };

  return (
    <div dir="rtl" className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-dark-gradient border-gold shadow-card p-8 text-right">
        <div className="text-center mb-6">
          <img src={logo.url} alt="Lion Store" className="mx-auto size-20 rounded-full ring-2 ring-gold/40" />
          <h1 className="mt-4 text-2xl font-black text-gold-gradient">إنشاء حساب</h1>
          <p className="text-sm text-muted-foreground mt-1">انضم لـ Lion Store</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-bold mb-1 block">الاسم بالكامل</label>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold/50" />
          </div>
          <div>
            <label className="text-xs font-bold mb-1 block">رقم الموبايل</label>
            <input required value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="01XXXXXXXXX" maxLength={20} className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 text-right focus:outline-none focus:ring-2 focus:ring-gold/50" />
          </div>
          <div>
            <label className="text-xs font-bold mb-1 block">الإيميل</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold/50" />
          </div>
          <div>
            <label className="text-xs font-bold mb-1 block">كلمة السر</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold/50" />
          </div>
          <button disabled={loading} className="w-full rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold disabled:opacity-50">
            {loading ? "جاري إنشاء الحساب..." : "إنشاء الحساب"}
          </button>
        </form>

        <div className="flex items-center gap-2 my-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">أو</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button onClick={google} className="w-full rounded-xl border border-border bg-card hover:bg-secondary py-3 font-bold flex items-center justify-center gap-2">
          <svg className="size-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          تسجيل بـ Google
        </button>

        <p className="mt-6 text-sm text-center text-muted-foreground">
          لديك حساب بالفعل؟ <Link to="/login" className="text-gold font-bold">دخول</Link>
        </p>
      </div>
    </div>
  );
}
