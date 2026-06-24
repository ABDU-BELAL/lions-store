import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listShopProducts, purchaseProduct, listMyOrders, getMyProductDiscount } from "@/lib/shop.functions";
import { getMyAccount } from "@/lib/account.functions";
import { useAuth } from "@/hooks/useAuth";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import proframe from "@/assets/proframe.png.asset.json";
import { Wallet, X, ShoppingBag, Clock, CheckCircle2, XCircle, Search as SearchIcon } from "lucide-react";
import { z } from "zod";
import { useLang, pickLocalized } from "@/i18n/LanguageProvider";
import { useCurrency } from "@/i18n/CurrencyProvider";

const shopSearch = z.object({ q: z.string().optional().catch("") });

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop — Lion Store / المتجر" },
      { name: "description", content: "Browse Lion Store — top up games and apps at competitive prices with instant delivery." },
      { property: "og:url", content: "https://lions-stores.com/shop" },
    ],
    links: [{ rel: "canonical", href: "https://lions-stores.com/shop" }],
  }),
  validateSearch: shopSearch,
  component: ShopPage,
});

type Product = Awaited<ReturnType<typeof listShopProducts>>[number];

function ShopPage() {
  const { user } = useAuth();
  const { q = "" } = Route.useSearch();
  const navigate = useNavigate({ from: "/shop" });
  const qc = useQueryClient();
  const listFn = useServerFn(listShopProducts);
  const accountFn = useServerFn(getMyAccount);
  const ordersFn = useServerFn(listMyOrders);
  const purchaseFn = useServerFn(purchaseProduct);
  const discountFn = useServerFn(getMyProductDiscount);
  const { t, lang, dir } = useLang();

  const products = useQuery({ queryKey: ["shop-products"], queryFn: () => listFn() });
  const account = useQuery({ queryKey: ["account"], queryFn: () => accountFn(), enabled: !!user });
  const orders = useQuery({ queryKey: ["my-orders", user?.id], queryFn: () => ordersFn(), enabled: !!user });

  const [selected, setSelected] = useState<Product | null>(null);
  const [gameId, setGameId] = useState("");
  const [idError, setIdError] = useState(false);
  const [quantity, setQuantity] = useState<string>("");
  const discount = useQuery({
    queryKey: ["my-discount", selected?.id, user?.id],
    queryFn: () => discountFn({ data: { productId: selected!.id } }),
    enabled: !!user && !!selected,
  });
  const discountPct = Number(discount.data?.percent ?? 0);

  const statusMap = {
    pending: { label: t("قيد التنفيذ", "Pending"), icon: Clock, color: "text-gold" },
    completed: { label: t("تم", "Done"), icon: CheckCircle2, color: "text-emerald-400" },
    cancelled: { label: t("ملغي", "Cancelled"), icon: XCircle, color: "text-destructive" },
    rejected: { label: t("مرفوض", "Rejected"), icon: XCircle, color: "text-destructive" },
  } as const;

  const mutation = useMutation({
    mutationFn: (vars: { productId: string; gameUserId?: string; quantity?: number }) => purchaseFn({ data: vars }),
    onSuccess: () => {
      toast.success(t("تم إرسال الطلب! هيتم تنفيذه قريبًا.", "Order placed! It will be processed shortly."));
      setSelected(null);
      setGameId("");
      setQuantity("");
      qc.invalidateQueries({ queryKey: ["account"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    },
    onError: (e: Error) => {
      const msg = e.message.includes("Insufficient")
        ? t("رصيدك غير كافٍ. اشحن الرصيد أولًا.", "Insufficient balance. Top up first.")
        : e.message.includes("Not authenticated")
        ? t("سجّل دخول أولًا.", "Sign in first.")
        : e.message;
      toast.error(msg);
    },
  });

  const [tab, setTab] = useState<"games" | "apps">("games");

  const balance = Number(account.data?.balance ?? 0);
  const allList = products.data ?? [];
  const currency = lang === "en" ? "EGP" : "EG";
  const locale = lang === "en" ? "en-US" : "ar-EG";

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    const byTab = allList.filter((p) => (p.category ?? "").toLowerCase() === tab);
    if (!query) return byTab;
    return byTab.filter((p) =>
      p.title.toLowerCase().includes(query) ||
      ((p as { title_en?: string | null }).title_en ?? "").toLowerCase().includes(query) ||
      (p.description ?? "").toLowerCase().includes(query),
    );
  }, [allList, q, tab]);

  return (
    <AppLayout>
      <div className="rounded-3xl bg-dark-gradient border-gold p-6 shadow-card flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gold-gradient">{t("المتجر", "Shop")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("اشترِ بالرصيد مباشرة — التنفيذ خلال دقائق.", "Pay with your balance — processed within minutes.")}</p>
        </div>
        {user && (
          <Link to="/topup" className="hidden sm:flex items-center gap-2 rounded-2xl border-gold bg-gradient-to-l from-gold-deep/30 to-gold/10 px-4 py-3">
            <Wallet className="size-5 text-gold" />
            <div>
              <p className="text-[10px] text-muted-foreground">{t("رصيدك", "Your balance")}</p>
              <p className="text-sm font-black text-gold-gradient">{currency} {balance.toLocaleString()}</p>
            </div>
          </Link>
        )}
      </div>

      <div className="mt-5 relative">
        <SearchIcon className={`absolute ${dir === "rtl" ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 size-5 text-gold`} />
        <input
          value={q}
          onChange={(e) => navigate({ search: { q: e.target.value || undefined }, replace: true })}
          placeholder={t("ابحث داخل المتجر...", "Search the store...")}
          className={`w-full rounded-full bg-secondary/60 border border-border py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 ${dir === "rtl" ? "pr-12 pl-4" : "pl-12 pr-4"}`}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-secondary/40 p-1 border border-border">
        {([
          { id: "games" as const, label: t("الألعاب", "Games") },
          { id: "apps" as const, label: t("التطبيقات", "Apps") },
        ]).map((tt) => (
          <button
            key={tt.id}
            onClick={() => setTab(tt.id)}
            className={`py-2.5 rounded-xl text-sm font-extrabold transition ${tab === tt.id ? "bg-gold-gradient text-primary-foreground shadow-gold" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tt.label}
          </button>
        ))}
      </div>

      {products.isLoading && <p className="mt-8 text-center text-muted-foreground">{t("جاري التحميل...", "Loading...")}</p>}
      {!products.isLoading && list.length === 0 && (
        <div className="mt-10 text-center text-muted-foreground">
          <ShoppingBag className="mx-auto size-12 mb-3 opacity-50" />
          <p>{q ? t("لا توجد نتائج لبحثك", "No results for your search") : t("لا توجد منتجات حاليًا.", "No products yet.")}</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {list.map((p) => {
          const title = pickLocalized(p.title, (p as { title_en?: string | null }).title_en, lang);
          const description = pickLocalized(p.description, (p as { description_en?: string | null }).description_en, lang);
          return (
            <div key={p.id} className="group relative rounded-2xl overflow-hidden bg-dark-gradient shadow-card border border-gold/20 transition-transform hover:-translate-y-1 hover:shadow-gold">
              {p.is_offer && (
                <span className={`absolute top-2 ${dir === "rtl" ? "right-2" : "left-2"} z-20 text-[10px] font-extrabold bg-destructive text-destructive-foreground rounded-full px-2 py-1`}>{t("عرض", "Offer")}</span>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!user) { toast.error(t("سجّل دخول أولًا", "Sign in first")); return; }
                  setSelected(p);
                }}
                className="block w-full"
              >
                <div className="relative aspect-square p-6 flex items-center justify-center">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_oklch(0.7_0.18_75/_18%),_transparent_65%)]" />
                  <div className="relative w-full h-full grid place-items-center">
                    {p.image_url ? (
                      <img src={p.image_url} alt={title} className="absolute inset-[18%] w-[64%] h-[64%] object-cover rounded-2xl z-10" />
                    ) : (
                      <div className="absolute inset-[18%] w-[64%] h-[64%] grid place-items-center rounded-2xl bg-secondary z-10 text-3xl">🎮</div>
                    )}
                    <img src={proframe.url} alt="" aria-hidden className="relative w-full h-full object-contain drop-shadow-[0_0_20px_oklch(0.7_0.18_75/_40%)]" />
                  </div>
                </div>
                <div className="px-4 pt-1 text-center">
                  <h3 className="text-sm font-extrabold text-gold-gradient line-clamp-1">{title}</h3>
                  {description && (
                    <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 whitespace-pre-line">{description}</p>
                  )}
                  <p className="mt-1 text-lg font-black text-gold">{currency} {Number(p.price).toLocaleString()}</p>
                </div>
              </button>
              <div className="px-4 pb-4 pt-2 text-center">
                <Link to="/product/$id" params={{ id: p.id }} className="text-[11px] text-muted-foreground hover:text-gold underline">
                  {t("التفاصيل", "Details")}
                </Link>
              </div>
              <div className="absolute inset-x-0 top-0 h-1 bg-gold-gradient opacity-80" />
            </div>
          );
        })}
      </div>

      {/* History */}
      {user && (orders.data ?? []).length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-extrabold text-gold-gradient">{t("طلباتك", "Your orders")}</h2>
          <div className="mt-3 rounded-2xl overflow-hidden border border-border bg-card/70">
            {(orders.data ?? []).map((o, i) => {
              const s = statusMap[o.status as keyof typeof statusMap] ?? statusMap.pending;
              return (
                <div key={o.id} className={`flex items-center justify-between gap-3 p-4 ${i ? "border-t border-border" : ""}`}>
                  <div className="flex items-center gap-3">
                    <s.icon className={`size-5 ${s.color}`} />
                    <div>
                      <p className="font-extrabold text-sm">{o.product_title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString(locale)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="font-extrabold">{currency} {Number(o.amount).toLocaleString()}</p>
                    <p className={`text-xs font-bold ${s.color}`}>{s.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Purchase modal */}
      {selected && (() => {
        const sel = selected as Product & { quantity_enabled?: boolean; unit_size?: number; unit_label?: string | null; min_quantity?: number | null; max_quantity?: number | null; title_en?: string | null; description_en?: string | null };
        const selTitle = pickLocalized(sel.title, sel.title_en, lang);
        const selDescription = pickLocalized(sel.description, sel.description_en, lang);
        const qtyEnabled = !!sel.quantity_enabled;
        const unitSize = Number(sel.unit_size ?? 1) || 1;
        const unitLabel = sel.unit_label ?? "";
        const minQty = sel.min_quantity != null ? Number(sel.min_quantity) : null;
        const maxQty = sel.max_quantity != null ? Number(sel.max_quantity) : null;
        const qtyNum = Number(quantity) || 0;
        const baseUnitPrice = Number(sel.price);
        const discountedUnitPrice = discountPct > 0 ? Math.round(baseUnitPrice * (1 - discountPct / 100) * 100) / 100 : baseUnitPrice;
        const baseTotal = qtyEnabled ? Math.round((qtyNum / unitSize) * baseUnitPrice * 100) / 100 : baseUnitPrice;
        const total = discountPct > 0 ? Math.round(baseTotal * (1 - discountPct / 100) * 100) / 100 : baseTotal;
        const qtyValid = !qtyEnabled || (qtyNum > 0 && (minQty == null || qtyNum >= minQty) && (maxQty == null || qtyNum <= maxQty));
        return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => { setSelected(null); setQuantity(""); }}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-card border-gold shadow-card p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => { setSelected(null); setQuantity(""); }} className={`absolute top-3 ${dir === "rtl" ? "left-3" : "right-3"} grid place-items-center size-9 rounded-full bg-secondary hover:bg-secondary/70`}>
              <X className="size-5" />
            </button>
            <h3 className="text-xl font-black text-gold-gradient text-center">{t("تأكيد الشراء", "Confirm purchase")}</h3>
            <div className="mt-4 rounded-2xl bg-secondary/40 p-4 text-center">
              <p className="text-sm text-muted-foreground">{selTitle}</p>
              {selDescription && (
                <p className="mt-2 text-xs text-foreground/80 whitespace-pre-line">{selDescription}</p>
              )}
              {qtyEnabled ? (
                <div className="mt-1">
                  {discountPct > 0 && <p className="text-xs text-muted-foreground line-through">{currency} {baseUnitPrice.toLocaleString()}</p>}
                  <p className="text-base font-bold text-gold">
                    {currency} {discountedUnitPrice.toLocaleString()} <span className="text-xs text-muted-foreground">/ {t("كل", "per")} {unitSize.toLocaleString()} {unitLabel || t("وحدة", "unit")}</span>
                  </p>
                  {discountPct > 0 && <p className="mt-1 text-xs font-extrabold text-gold-gradient">{t("خصم", "Discount")} {discountPct}%</p>}
                </div>
              ) : (
                <div className="mt-1">
                  {discountPct > 0 && <p className="text-base text-muted-foreground line-through">{currency} {baseUnitPrice.toLocaleString()}</p>}
                  <p className="text-3xl font-black text-gold">{currency} {total.toLocaleString()}</p>
                  {discountPct > 0 && <p className="mt-1 text-xs font-extrabold text-gold-gradient">{t("خصم", "Discount")} {discountPct}%</p>}
                </div>
              )}
            </div>

            {qtyEnabled && (
              <div className="mt-4">
                <label className="text-xs font-bold mb-1 block">
                  {t("الكمية", "Quantity")} {unitLabel ? `(${unitLabel})` : ""}
                  {minQty != null && <span className="text-muted-foreground"> — {t("حد أدنى", "min")} {minQty.toLocaleString()}</span>}
                  {maxQty != null && <span className="text-muted-foreground"> — {t("حد أقصى", "max")} {maxQty.toLocaleString()}</span>}
                </label>
                <input
                  type="number"
                  min={minQty ?? 1}
                  max={maxQty ?? undefined}
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder={String(minQty ?? unitSize)}
                  className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold/50"
                />
                <div className="mt-3 flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 p-3">
                  <span className="text-sm text-muted-foreground">{t("الإجمالي", "Total")}</span>
                  <span>
                    {discountPct > 0 && <span className="block text-xs text-muted-foreground line-through">{currency} {baseTotal.toLocaleString()}</span>}
                    <span className="block text-2xl font-black text-gold-gradient">{currency} {total.toLocaleString()}</span>
                  </span>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("رصيدك الحالي", "Your balance")}</span>
              <span className="font-extrabold text-gold-gradient">{currency} {balance.toLocaleString()}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("الرصيد بعد الشراء", "Balance after purchase")}</span>
              <span className={`font-extrabold ${balance - total < 0 ? "text-destructive" : "text-emerald-400"}`}>
                {currency} {(balance - total).toLocaleString()}
              </span>
            </div>

            <div className="mt-4">
              <label className="text-xs font-bold mb-1 block">
                {sel.category === "games" ? t("ID اللاعب", "Player ID") : t("ID الحساب / رقم التعريف", "Account ID")} <span className="text-destructive">*</span>
              </label>
              <input
                value={gameId}
                onChange={(e) => { setGameId(e.target.value); if (idError) setIdError(false); }}
                placeholder={t("مثلاً: 123456789", "e.g. 123456789")}
                className={`w-full rounded-xl bg-secondary/60 border px-4 py-3 focus:outline-none focus:ring-2 ${idError ? "border-destructive ring-1 ring-destructive focus:ring-destructive/60" : "border-border focus:ring-gold/50"}`}
              />
              {idError && (
                <p className="mt-1 text-xs font-semibold text-destructive">{t("الـ ID مفقود", "ID is missing")}</p>
              )}
            </div>

            {balance < total ? (
              <Link
                to="/topup"
                className="mt-5 w-full block text-center rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold"
              >
                {t("اشحن رصيدك أولًا", "Top up your balance first")}
              </Link>
            ) : (
              <button
                disabled={mutation.isPending || !qtyValid}
                onClick={() => {
                  if (!gameId.trim()) { setIdError(true); toast.error(t("الـ ID مفقود", "ID is missing")); return; }
                  mutation.mutate({ productId: sel.id, gameUserId: gameId.trim(), quantity: qtyEnabled ? qtyNum : undefined });
                }}
                className="mt-5 w-full rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold disabled:opacity-50"
              >
                {mutation.isPending ? t("جاري التنفيذ...", "Processing...") : qtyEnabled ? `${t("أكد الشراء", "Confirm")} — ${currency} ${total.toLocaleString()}` : t("أكد الشراء", "Confirm purchase")}
              </button>
            )}
          </div>
        </div>
        );
      })()}
    </AppLayout>
  );
}
