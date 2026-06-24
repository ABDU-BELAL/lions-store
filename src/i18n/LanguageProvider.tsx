import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (ar: string, en: string) => string;
  dir: "rtl" | "ltr";
};

const LanguageContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "lion_lang";

function readInitial(): Lang {
  if (typeof window === "undefined") return "ar";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "en" ? "en" : "ar";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  // hydrate from localStorage on client
  useEffect(() => {
    const initial = readInitial();
    setLangState(initial);
  }, []);

  // sync to <html> attrs
  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    html.setAttribute("lang", lang);
    html.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { window.localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  };

  const t = (ar: string, en: string) => (lang === "en" ? en : ar);
  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}

/** Pick the EN value when available, otherwise fall back to AR. */
export function pickLocalized(ar: string | null | undefined, en: string | null | undefined, lang: Lang): string {
  if (lang === "en") return (en && en.trim()) || ar || "";
  return ar || en || "";
}
