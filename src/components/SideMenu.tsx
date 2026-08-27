import { Link } from "@tanstack/react-router";
import {
  X, LogIn, LogOut, User, Info, Shield, ShieldCheck, KeyRound, Languages,
  MessageCircle, Send, Headphones, Wallet, UserPlus,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import logo from "@/assets/logo.jpeg";
import { useLang } from "@/i18n/LanguageProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  user: { id: string } | null;
  name?: string | null;
  customId?: string | null;
  balanceLabel?: string;
  isAdmin?: boolean;
  isPartner?: boolean;
  onSignOut: () => void;
};

function Row({ to, href, icon, label, onClick, tone = "default" }: {
  to?: string; href?: string; icon: ReactNode; label: string; onClick?: () => void;
  tone?: "default" | "gold" | "danger";
}) {
  const cls =
    tone === "gold"
      ? "border-gold/50 bg-gradient-to-l from-gold-deep/25 to-gold/5 text-gold-soft"
      : tone === "danger"
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : "border-border bg-secondary/40 hover:bg-secondary/70";
  const inner = (
    <>
      <span className="grid place-items-center size-9 rounded-xl bg-background/60 border border-border/60">{icon}</span>
      <span className="font-bold text-sm">{label}</span>
    </>
  );
  const base = `flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors ${cls}`;
  if (to) return <Link to={to} onClick={onClick} className={base}>{inner}</Link>;
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={base}>{inner}</a>;
  return <button type="button" onClick={onClick} className={`${base} w-full text-start`}>{inner}</button>;
}

export function SideMenu({ open, onClose, user, name, customId, balanceLabel, isAdmin, isPartner, onSignOut }: Props) {
  const { t, dir, lang, setLang } = useLang();
  const side = dir === "rtl" ? "right-0" : "left-0";
  const hidden = dir === "rtl" ? "translate-x-full" : "-translate-x-full";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      />
      <aside
        dir={dir}
        role="dialog"
        aria-modal="true"
        aria-label={t("القائمة", "Menu")}
        className={`fixed top-0 ${side} z-[61] h-full w-[86%] max-w-sm overflow-y-auto border-gold bg-background/95 backdrop-blur-xl shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : hidden}`}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Lion Store" className="size-10 rounded-full object-cover ring-2 ring-gold/40" />
            <span className="text-gold-gradient font-extrabold tracking-wide">LION STORE</span>
          </div>
          <button type="button" onClick={onClose} aria-label={t("إغلاق القائمة", "Close menu")}
            className="grid place-items-center size-9 rounded-lg bg-secondary/70 border border-border">
            <X className="size-5" />
          </button>
        </div>

        {user ? (
          <div className="m-4 rounded-2xl border-gold bg-gradient-to-l from-gold-deep/20 to-transparent p-4">
            <p className="text-base font-extrabold">{name || t("مستخدم", "User")}</p>
            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">ID: {customId ?? "—"}</p>
            {balanceLabel && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-background/60 border border-border px-3 py-1 text-sm font-bold text-gold-soft">
                <Wallet className="size-4" /> {balanceLabel}
              </p>
            )}
          </div>
        ) : (
          <div className="m-4 grid gap-2">
            <Row to="/login" onClick={onClose} tone="gold" icon={<LogIn className="size-4" />} label={t("تسجيل الدخول", "Sign in")} />
            <Row to="/signup" onClick={onClose} icon={<UserPlus className="size-4" />} label={t("إنشاء حساب", "Create account")} />
          </div>
        )}

        <nav className="px-4 pb-6 grid gap-2">
          {user && (
            <>
              <Row to="/profile" onClick={onClose} icon={<User className="size-4" />} label={t("الملف الشخصي", "Personal profile")} />
              <Row to="/kyc" onClick={onClose} icon={<ShieldCheck className="size-4" />} label={t("توثيق الحساب (KYC)", "KYC verification")} />
              {isPartner && (
                <Row to="/api-access" onClick={onClose} tone="gold" icon={<KeyRound className="size-4" />} label={t("واجهة الـ API الخاصة بي", "My API access")} />
              )}
              {isAdmin && (
                <Row to="/admin" onClick={onClose} tone="gold" icon={<Shield className="size-4" />} label={t("لوحة الأدمن", "Admin panel")} />
              )}
            </>
          )}

          <Row to="/about" onClick={onClose} icon={<Info className="size-4" />} label={t("من نحن", "About us")} />

          <p className="mt-3 px-1 text-xs font-bold text-muted-foreground">{t("تواصل معنا", "Get in touch")}</p>
          <Row href="https://wa.me/201010594146" onClick={onClose} icon={<Headphones className="size-4" />} label={t("دعم واتساب", "WhatsApp support")} />
          <Row href="https://whatsapp.com/channel/0029Vb6QqbqInlqQmQ0kMz1o" onClick={onClose} icon={<MessageCircle className="size-4" />} label={t("قناة واتساب", "WhatsApp channel")} />
          <Row href="https://t.me/lionstore_eg" onClick={onClose} icon={<Send className="size-4" />} label={t("قناة تليجرام", "Telegram channel")} />

          <button
            type="button"
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 px-3 py-2.5 font-bold text-sm"
          >
            <span className="grid place-items-center size-9 rounded-xl bg-background/60 border border-border/60"><Languages className="size-4" /></span>
            {lang === "ar" ? "English" : "العربية"}
          </button>

          {user && (
            <Row onClick={() => { onClose(); onSignOut(); }} tone="danger" icon={<LogOut className="size-4" />} label={t("تسجيل الخروج", "Sign out")} />
          )}
        </nav>
      </aside>
    </>
  );
}
