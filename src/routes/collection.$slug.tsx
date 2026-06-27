import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { getCollectionBySlug } from "@/lib/collections.functions";
import { purchaseProduct } from "@/lib/shop.functions";
import { getMyAccount } from "@/lib/account.functions";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";
import { FramedImage } from "@/components/FramedImage";
import { Wallet, X, ShoppingBag } from "lucide-react";
import { useLang, pickLocalized } from "@/i18n/LanguageProvider";
import { useCurrency } from "@/i18n/CurrencyProvider";
import { useEffectiveDiscount } from "@/hooks/useEffectiveDiscount";

export const Route = createFileRoute("/collection/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Lion Store` }] }),
  errorComponent: ({ error }) => <AppLayout><p className="text-center py-12 text-destructive">{error.message}</p></AppLayout>,
  notFoundComponent: () => <AppLayout><p className="text-center py-12 text-muted-foreground">Category not found</p></AppLayout>,
  component: CollectionPage,
});

type ColProduct = {
  id: string; title: string; title_en?: string | null; description: string | null; description_en?: string | null;
  price: number; image_url: string | null; is_offer: boolean; category: string;
  quantity_enabled?: boolean; unit_size?: number; unit_label?: string | null; min_quantity?: number | null; max_quantity?: number | null;
  purchase_field_mode?: "game_id" | "subscription" | "none";
};

function CollectionPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchCollection = useServerFn(getCollectionBySlug);
  const accountFn = useServerFn(getMyAccount);
  const purchaseFn = useServerFn(purchaseProduct);
  const { t, lang, dir } = useLang();
  const { format } = useCurrency();

  const { data, isLoading } = useQuery({
    queryKey: ["collection", slug],
    queryFn: () => fetchCollection({ data: { slug } }),
  });
  const account = useQuery({ queryKey: ["account"], queryFn: () => accountFn(), enabled: !!user });

  const [selected, setSelected] = useState<ColProduct | null>(null);
  const [gameId, setGameId] = useState("");
  const [subPassword, setSubPassword] = useState("");
  const [idError, setIdError] = useState(false);
  const [pwError, setPwError] = useState(false);
  const [quantity, setQuantity] = useState<string>("");

  const mutation = useMutation({
    mutationFn: (vars: { productId: string; gameUserId?: string; quantity?: number }) => purchaseFn({ data: vars }),
    onSuccess: () => {
      toast.success(t("تم إرسال الطلب!", "Order placed!"));
      setSelected(null); setGameId(""); setQuantity("");
      qc.invalidateQueries({ queryKey: ["account"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    },
    onError: (e: Error) => toast.error(e.message.includes("Insufficient") ? t("رصيدك غير كافٍ.", "Insufficient balance.") : e.message),
  });

  if (isLoading) return <AppLayout><p className="text-center py-12 text-muted-foreground">{t("جاري التحميل...", "Loading...")}</p></AppLayout>;
  if (!data) return <AppLayout><p className="text-center py-12 text-muted-foreground">{t("القسم غير موجود", "Category not found")}</p></AppLayout>;

  const balance = Number(account.data?.balance ?? 0);
  const colTitle = pickLocalized(data.collection.title, (data.collection as { title_en?: string | null }).title_en, lang);
  const children = (data as { children?: Array<{ id: string; slug: string; title: string; title_en: string | null; image_url: string | null }> }).children ?? [];
  const parent = (data as { parent?: { slug: string; title: string; title_en: string | null } | null }).parent ?? null;
  const hasChildren = children.length > 0;

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <nav className="text-xs text-muted-foreground mb-3 flex items-center gap-1 flex-wrap">
        <Link to="/categories" className="hover:text-gold">{t("الأقسام", "Categories")}</Link>
        <span>›</span>
        {parent && (
          <>
            <Link to="/collection/$slug" params={{ slug: parent.slug }} className="hover:text-gold">{pickLocalized(parent.title, parent.title_en, lang)}</Link>
            <span>›</span>
          </>
        )}
        <span className="text-foreground font-bold">{colTitle}</span>
      </nav>

      <div className="rounded-3xl bg-dark-gradient border-gold p-6 md:p-8 shadow-card flex items-center gap-5">
        {data.collection.image_url && (
          <img src={data.collection.image_url} alt={colTitle} className="size-20 rounded-2xl object-cover ring-2 ring-gold/40" />
        )}
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-gold-gradient">{colTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {hasChildren
              ? `${children.length} ${t("قسم فرعي", "subcategory(ies)")}`
              : `${data.products.length} ${t("منتج", "product(s)")}`}
          </p>
        </div>
      </div>

      {hasChildren ? (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {children.map((ch) => {
            const chTitle = pickLocalized(ch.title, ch.title_en, lang);
            return (
              <Link key={ch.id} to="/collection/$slug" params={{ slug: ch.slug }} className="group rounded-2xl overflow-hidden bg-dark-gradient border border-gold/30 hover:border-gold/70 hover:shadow-gold transition text-center">
                <FramedImage src={ch.image_url} alt={chTitle} />
                <p className="font-extrabold text-sm p-3 text-gold-gradient">{chTitle}</p>
              </Link>
            );
          })}
        </div>
      ) : (
        <>
          {data.products.length === 0 && (
            <div className="mt-10 text-center text-muted-foreground">
              <ShoppingBag className="mx-auto size-12 mb-3 opacity-50" />
              <p>{t("لا يوجد منتجات في هذا القسم بعد.", "No products in this category yet.")}</p>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.products.map((p) => {
              const pp = p as ColProduct;
              const title = pickLocalized(pp.title, pp.title_en, lang);
              const description = pickLocalized(pp.description, pp.description_en, lang);
              return (
                <button
                  key={pp.id}
                  onClick={() => { if (!user) { toast.error(t("سجّل دخول أولًا", "Sign in first")); return; } setSelected(pp); }}
                  className="group relative rounded-2xl overflow-hidden bg-dark-gradient shadow-card border border-gold/20 transition-transform hover:-translate-y-1 hover:shadow-gold"
                >
                  {pp.is_offer && <span className={`absolute top-2 ${dir === "rtl" ? "right-2" : "left-2"} z-20 text-[10px] font-extrabold bg-destructive text-destructive-foreground rounded-full px-2 py-1`}>{t("عرض", "Offer")}</span>}
                  <FramedImage src={pp.image_url} alt={title} />
                  <div className="px-4 pb-4 pt-1 text-center">
                    <h3 className="text-sm font-extrabold text-gold-gradient line-clamp-1">{title}</h3>
                    {description && (
                      <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 whitespace-pre-line">{description}</p>
                    )}
                    <p className="mt-1 text-lg font-black text-gold">{format(Number(pp.price))}</p>
                  </div>
                  <div className="absolute inset-x-0 top-0 h-1 bg-gold-gradient opacity-80" />
                </button>
              );
            })}
          </div>
        </>
      )}

      {selected && <PurchaseModal
        selected={selected}
        onClose={() => { setSelected(null); setQuantity(""); setGameId(""); setSubPassword(""); setIdError(false); setPwError(false); }}
        gameId={gameId} setGameId={setGameId}
        subPassword={subPassword} setSubPassword={setSubPassword}
        idError={idError} setIdError={setIdError}
        pwError={pwError} setPwError={setPwError}
        quantity={quantity} setQuantity={setQuantity}
        balance={balance} mutation={mutation}
        t={t} lang={lang} dir={dir} format={format}
      />}
    </AppLayout>
  );
}

type ModalProps = {
  selected: ColProduct; onClose: () => void;
  gameId: string; setGameId: (v: string) => void;
  subPassword: string; setSubPassword: (v: string) => void;
  idError: boolean; setIdError: (v: boolean) => void;
  pwError: boolean; setPwError: (v: boolean) => void;
  quantity: string; setQuantity: (v: string) => void;
  balance: number;
  mutation: { mutate: (v: { productId: string; gameUserId?: string; quantity?: number }) => void; isPending: boolean };
  t: (a: string, b: string) => string; lang: string; dir: string; format: (n: number) => string;
};

function PurchaseModal({ selected, onClose, gameId, setGameId, subPassword, setSubPassword, idError, setIdError, pwError, setPwError, quantity, setQuantity, balance, mutation, t, lang, dir, format }: ModalProps) {
  const { percent: discountPct } = useEffectiveDiscount(selected.id);
  const qtyEnabled = !!selected.quantity_enabled;
  const unitSize = Number(selected.unit_size ?? 1) || 1;
  const unitLabel = selected.unit_label ?? "";
  const minQty = selected.min_quantity != null ? Number(selected.min_quantity) : null;
  const maxQty = selected.max_quantity != null ? Number(selected.max_quantity) : null;
  const qtyNum = Number(quantity) || 0;
  const baseTotal = qtyEnabled ? Math.round((qtyNum / unitSize) * Number(selected.price) * 100) / 100 : Number(selected.price);
  const total = discountPct > 0 ? Math.round(baseTotal * (1 - discountPct / 100) * 100) / 100 : baseTotal;
  const qtyValid = !qtyEnabled || (qtyNum > 0 && (minQty == null || qtyNum >= minQty) && (maxQty == null || qtyNum <= maxQty));
  const selTitle = pickLocalized(selected.title, selected.title_en, lang);
  const selDesc = pickLocalized(selected.description, selected.description_en, lang);
  return (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => { setSelected(null); setQuantity(""); }}>
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-card border-gold shadow-card p-6 relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => { setSelected(null); setQuantity(""); }} className={`absolute top-3 ${dir === "rtl" ? "left-3" : "right-3"} grid place-items-center size-9 rounded-full bg-secondary`}><X className="size-5" /></button>
              <h3 className="text-xl font-black text-gold-gradient text-center">{t("تأكيد الشراء", "Confirm purchase")}</h3>
              <div className="mt-4 rounded-2xl bg-secondary/40 p-4 text-center">
                <p className="text-sm text-muted-foreground">{selTitle}</p>
                {selDesc && (
                  <p className="mt-2 text-xs text-foreground/80 whitespace-pre-line">{selDesc}</p>
                )}
                {qtyEnabled ? (
                  <p className="text-base font-bold text-gold mt-1">{format(Number(selected.price))} <span className="text-xs text-muted-foreground">/ {t("كل", "per")} {unitSize.toLocaleString()} {unitLabel || t("وحدة", "unit")}</span></p>
                ) : (
                  <p className="text-3xl font-black text-gold mt-1">{format(Number(selected.price))}</p>
                )}
              </div>
              {qtyEnabled && (
                <div className="mt-4">
                  <label className="text-xs font-bold mb-1 block">
                    {t("الكمية", "Quantity")} {unitLabel ? `(${unitLabel})` : ""}
                    {minQty != null && <span className="text-muted-foreground"> — {t("حد أدنى", "min")} {minQty.toLocaleString()}</span>}
                    {maxQty != null && <span className="text-muted-foreground"> — {t("حد أقصى", "max")} {maxQty.toLocaleString()}</span>}
                  </label>
                  <input type="number" min={minQty ?? 1} max={maxQty ?? undefined} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={String(minQty ?? unitSize)} className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3" />
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 p-3">
                    <span className="text-sm text-muted-foreground">{t("الإجمالي", "Total")}</span>
                    <span className="text-2xl font-black text-gold-gradient">{format(total)}</span>
                  </div>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1"><Wallet className="size-4" />{t("رصيدك", "Your balance")}</span>
                <span className="font-extrabold text-gold-gradient">{format(balance)}</span>
              </div>
              {(() => {
                const fieldMode = (selected.purchase_field_mode ?? "game_id") as "game_id" | "subscription" | "none";
                return (
                  <>
                    {fieldMode !== "none" && (
                      <div className="mt-4 space-y-3">
                        <div>
                          <label className="text-xs font-bold mb-1 block">
                            {fieldMode === "subscription"
                              ? <>{t("البريد الإلكتروني للاشتراك", "Subscription email")} <span className="text-destructive">*</span></>
                              : <>{selected.category === "games" ? t("ID اللاعب", "Player ID") : t("ID الحساب / رقم التعريف", "Account ID")} <span className="text-destructive">*</span></>}
                          </label>
                          <input type={fieldMode === "subscription" ? "email" : "text"} value={gameId} onChange={(e) => { setGameId(e.target.value); if (idError) setIdError(false); }} placeholder={fieldMode === "subscription" ? "you@example.com" : "123456789"} className={`w-full rounded-xl bg-secondary/60 border px-4 py-3 ${idError ? "border-destructive ring-1 ring-destructive" : "border-border"}`} />
                          {idError && (
                            <p className="mt-1 text-xs font-semibold text-destructive">{fieldMode === "subscription" ? t("بريد إلكتروني غير صالح", "Invalid email") : t("الـ ID مفقود", "ID is missing")}</p>
                          )}
                        </div>
                        {fieldMode === "subscription" && (
                          <div>
                            <label className="text-xs font-bold mb-1 block">{t("كلمة المرور", "Password")} <span className="text-destructive">*</span></label>
                            <input type="text" value={subPassword} onChange={(e) => { setSubPassword(e.target.value); if (pwError) setPwError(false); }} placeholder={t("كلمة مرور الحساب", "Account password")} className={`w-full rounded-xl bg-secondary/60 border px-4 py-3 ${pwError ? "border-destructive ring-1 ring-destructive" : "border-border"}`} />
                            {pwError && (
                              <p className="mt-1 text-xs font-semibold text-destructive">{t("كلمة المرور مفقودة", "Password is missing")}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {balance < total ? (
                      <Link to="/topup" className="mt-5 w-full block text-center rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold">{t("اشحن رصيدك أولًا", "Top up your balance first")}</Link>
                    ) : (
                      <button disabled={mutation.isPending || !qtyValid} onClick={() => {
                        let payload: string | undefined;
                        if (fieldMode === "game_id") {
                          if (!gameId.trim()) { setIdError(true); toast.error(t("الـ ID مفقود", "ID is missing")); return; }
                          payload = gameId.trim();
                        } else if (fieldMode === "subscription") {
                          const email = gameId.trim();
                          const pw = subPassword.trim();
                          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setIdError(true); toast.error(t("بريد إلكتروني غير صالح", "Invalid email")); return; }
                          if (!pw) { setPwError(true); toast.error(t("كلمة المرور مفقودة", "Password is missing")); return; }
                          payload = `${email} | ${pw}`;
                        }
                        mutation.mutate({ productId: selected.id, gameUserId: payload, quantity: qtyEnabled ? qtyNum : undefined });
                      }} className="mt-5 w-full rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold disabled:opacity-50">
                        {mutation.isPending ? "..." : qtyEnabled ? `${t("أكد الشراء", "Confirm")} — ${format(total)}` : t("أكد الشراء", "Confirm purchase")}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        );
      })()}
    </AppLayout>
  );
}
