import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
const RATE_TTL_MS = 60 * 60 * 1000; // 1h

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

async function fetchRate(): Promise<number | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) return null;
    const json = await res.json();
    const r = json?.rates?.EGP;
    return typeof r === "number" && r > 0 ? r : null;
  } catch { return null; }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("EGP");
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    setCurrencyState(readInitial());
    const cached = readCachedRate();
    if (cached) setRate(cached);
    fetchRate().then((r) => {
      if (r) {
        setRate(r);
        try { window.localStorage.setItem(RATE_KEY, JSON.stringify({ rate: r, at: Date.now() })); } catch { /* ignore */ }
      }
    });
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
