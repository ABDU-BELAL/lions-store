import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, ShoppingBag, Bell, Receipt, Search, Menu, Plus, LogIn, LogOut, Shield, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import logo from "@/assets/logo.jpeg.asset.json";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAccount } from "@/lib/account.functions";
import { supabase } from "@/integrations/supabase/client";
import { ParticlesBackground } from "@/components/ParticlesBackground";

const nav = [
  { to: "/", label: "الرئيسية", icon: Home },
  { to: "/shop", label: "المتجر", icon: ShoppingBag },
  { to: "/topup", label: "شحن", icon: Wallet },
  { to: "/transactions", label: "المعاملات", icon: Receipt },
  { to: "/search", label: "بحث", icon: Search },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerQ, setHeaderQ] = useState("");
  const { user } = useAuth();
  const getAccount = useServerFn(getMyAccount);
  const account = useQuery({
    queryKey: ["account", user?.id],
    queryFn: () => getAccount(),
    enabled: !!user,
    refetchOnMount: "always",
  });

  const balance = Number(account.data?.balance ?? 0);
  const isAdmin = account.data?.isAdmin ?? false;

  return (
    <div dir="rtl" className="min-h-screen pb-24">
      <ParticlesBackground />
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="mx-auto max-w-6xl px-2 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logo.url} alt="Lion Store" className="h-11 w-11 rounded-full object-cover ring-2 ring-gold/40" />
            <span className="hidden sm:block text-gold-gradient font-extrabold text-lg tracking-wide">LION STORE</span>
          </Link>

          <form
            role="search"
            className="flex-1 relative"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/search", search: { q: headerQ.trim() || undefined } });
            }}
          >
            <label htmlFor="header-search" className="sr-only">ابحث عن اللعبة أو التطبيق</label>
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              id="header-search"
              type="search"
              aria-label="ابحث عن اللعبة أو التطبيق"
              value={headerQ}
              onChange={(e) => setHeaderQ(e.target.value)}
              placeholder="ابحث عن اللعبة أو التطبيق"
              className="w-full rounded-full bg-secondary/60 border border-border pr-10 pl-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50"
            />
          </form>

          {user ? (
            <Link to="/topup" className="hidden md:flex items-center gap-2 rounded-full border-gold bg-gradient-to-l from-gold-deep/30 to-gold/10 px-3 py-2 text-sm font-bold">
              <span className="text-gold-soft">EG {balance.toLocaleString()}</span>
              <span className="grid place-items-center size-6 rounded-full bg-gold-gradient text-primary-foreground">
                <Plus className="size-4" />
              </span>
            </Link>
          ) : (
            <Link to="/login" className="hidden md:flex items-center gap-2 rounded-full bg-gold-gradient text-primary-foreground px-4 py-2 text-sm font-bold">
              <LogIn className="size-4" /> دخول
            </Link>
          )}

          <button
            type="button"
            aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="grid place-items-center size-10 rounded-lg bg-secondary/70 border border-border"
          >
            <Menu className="size-5" />
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-border bg-card/95 px-4 py-3 flex flex-wrap gap-2">
            {user ? (
              <>
                <Link to="/topup" onClick={() => setMenuOpen(false)} className="md:hidden flex items-center gap-2 rounded-full border-gold bg-gradient-to-l from-gold-deep/30 to-gold/10 px-3 py-2 text-sm font-bold">
                  <span className="text-gold-soft">EG {balance.toLocaleString()}</span>
                  <Plus className="size-4 text-gold" />
                </Link>
                {isAdmin && (
                  <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-full bg-gold-gradient text-primary-foreground px-4 py-2 text-sm font-bold">
                    <Shield className="size-4" /> لوحة الأدمن
                  </Link>
                )}
                <Link to="/about" onClick={() => setMenuOpen(false)} className="rounded-full bg-secondary/70 px-4 py-2 text-sm">من نحن</Link>
                <button
                  onClick={async () => { await supabase.auth.signOut(); setMenuOpen(false); }}
                  className="flex items-center gap-2 rounded-full bg-destructive/20 text-destructive border border-destructive/40 px-4 py-2 text-sm font-bold"
                >
                  <LogOut className="size-4" /> خروج
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMenuOpen(false)} className="md:hidden flex items-center gap-2 rounded-full bg-gold-gradient text-primary-foreground px-4 py-2 text-sm font-bold">
                  <LogIn className="size-4" /> دخول
                </Link>
                <Link to="/signup" onClick={() => setMenuOpen(false)} className="rounded-full bg-secondary/70 px-4 py-2 text-sm">إنشاء حساب</Link>
                <Link to="/about" onClick={() => setMenuOpen(false)} className="rounded-full bg-secondary/70 px-4 py-2 text-sm">من نحن</Link>
              </>
            )}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {children}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-28 pt-6 text-center text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 items-center justify-center">
        <Link to="/privacy" className="hover:text-gold">سياسة الخصوصية</Link>
        <span className="opacity-30">•</span>
        <Link to="/terms" className="hover:text-gold">شروط الاستخدام</Link>
        <span className="opacity-30">•</span>
        <Link to="/payments" className="hover:text-gold">طرق الدفع</Link>
        <span className="opacity-30">•</span>
        <Link to="/about" className="hover:text-gold">من نحن</Link>
        <span className="opacity-30">•</span>
        <a href="https://www.instagram.com/t_kv0/" target="_blank" rel="noopener noreferrer" className="hover:text-gold">
          تطوير وبرمجة: Abdelrahman Abdin
        </a>
      </footer>

      {/* WhatsApp support floating button */}
      <a
        href="https://wa.me/201010594146"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="تواصل عبر واتساب"
        className="fixed bottom-24 left-4 z-50 grid place-items-center size-14 rounded-full bg-[#25D366] shadow-lg hover:scale-110 transition-transform"
      >
        <svg viewBox="0 0 32 32" className="size-8 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 01-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 01-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.478-1.318.13-.33.244-.66.244-1.02 0-.402-1.346-.66-1.674-.717zm-2.94 7.182a8.255 8.255 0 01-4.197-1.146l-3.008.953.96-2.95a8.156 8.156 0 01-1.247-4.353c0-4.55 3.72-8.27 8.27-8.27S25.27 12.34 25.27 16.89c-.058 4.52-3.778 8.498-8.27 8.498zm0-18.218c-5.428 0-9.834 4.405-9.834 9.834.014 1.69.45 3.366 1.305 4.823L4.86 27.4l5.97-1.892a9.745 9.745 0 004.392 1.057c5.428 0 9.834-4.405 9.834-9.834 0-2.622-1.032-5.1-2.894-6.962a9.788 9.788 0 00-6.94-2.894z"/>
        </svg>
      </a>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 backdrop-blur-xl bg-background/90 border-t border-border">
        <div className="mx-auto max-w-6xl px-2 grid grid-cols-5">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? path === "/" : path.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className="flex flex-col items-center justify-center py-2.5 gap-1 text-xs"
              >
                <Icon className={`size-5 ${active ? "text-gold" : "text-muted-foreground"}`} />
                <span className={active ? "text-gold font-bold" : "text-muted-foreground"}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
