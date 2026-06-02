import { Link, useRouterState } from "@tanstack/react-router";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();
  const getAccount = useServerFn(getMyAccount);
  const account = useQuery({ queryKey: ["account"], queryFn: () => getAccount(), enabled: !!user });

  const balance = Number(account.data?.balance ?? 0);
  const isAdmin = account.data?.isAdmin ?? false;

  return (
    <div dir="rtl" className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logo.url} alt="Lion Store" className="h-11 w-11 rounded-full object-cover ring-2 ring-gold/40" />
            <span className="hidden sm:block text-gold-gradient font-extrabold text-lg tracking-wide">LION STORE</span>
          </Link>

          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              placeholder="ابحث عن اللعبة أو التطبيق"
              className="w-full rounded-full bg-secondary/60 border border-border pr-10 pl-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50"
            />
          </div>

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

          <button onClick={() => setMenuOpen((v) => !v)} className="grid place-items-center size-10 rounded-lg bg-secondary/70 border border-border">
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
