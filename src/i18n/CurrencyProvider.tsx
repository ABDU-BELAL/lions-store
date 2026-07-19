import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getUsdRate } from "@/lib/admin.functions";

export type Currency = "EGP" | "USD";

type Ctx = {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  /** USD -> EGP rate, e.g. 50 means 1 USD = 50 EGP. null while loading first time. */
  rate: number | null;
  /** Format an EGP amount in the currently selected currency. */
  format: (egpAmount: number) => string;
};

const CurrencyContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "lion_currency";
const RATE_KEY = "lion_usd_egp_rate";
const RATE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache; rate is manual so refresh is only for admin edits

function readInitial(): Currency {
  if (typeof window === "undefined") return "EGP";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "USD" ? "USD" : "EGP";
}

function readCachedRate(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { rate: number; at: number };
    if (!parsed?.rate || Date.now() - parsed.at > RATE_TTL_MS) return null;
    return parsed.rate;
  } catch { return null; }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("EGP");
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    setCurrencyState(readInitial());
    const cached = readCachedRate();
    if (cached) setRate(cached);
    // Fetch the manually-set rate from the server (super admin controlled).
    getUsdRate()
      .then((r) => {
        if (r?.rate && r.rate > 0) {
          setRate(r.rate);
          try { window.localStorage.setItem(RATE_KEY, JSON.stringify({ rate: r.rate, at: Date.now() })); } catch { /* ignore */ }
        }
      })
      .catch(() => { /* keep cached/null */ });
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    try { window.localStorage.setItem(STORAGE_KEY, c); } catch { /* ignore */ }
  };

  const format = (egpAmount: number) => {
    const n = Number(egpAmount) || 0;
    if (currency === "EGP" || !rate) {
      return `EGP ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    }
    const usd = n / rate;
    return `USD ${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rate, format }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
