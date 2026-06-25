import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AppLayout } from "@/components/AppLayout";
import { FramedImage } from "@/components/FramedImage";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { signBucketPath } from "@/lib/storage.server";
import { purchaseProduct, getMyProductDiscount } from "@/lib/shop.functions";
import { getMyAccount } from "@/lib/account.functions";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";
import { Wallet, ArrowRight, ArrowLeft } from "lucide-react";
import { useLang, pickLocalized } from "@/i18n/LanguageProvider";
import { useCurrency } from "@/i18n/CurrencyProvider";

export type Product = {
  id: string;
  title: string;
  title_en: string | null;
  description: string | null;
  description_en: string | null;
  category: string;
  price: number;
  image_url: string;
  is_offer: boolean;
  collection_id: string | null;
  quantity_enabled: boolean;
  unit_size: number;
  unit_label: string | null;
  min_quantity: number | null;
  max_quantity: number | null;
};

export const getProductById = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<Product | null> => {
    const { data: product, error } = await supabaseAdmin
      .from("products")
      .select("id, title, title_en, description, description_en, category, price, image_url, is_offer, collection_id, quantity_enabled, unit_size, unit_label, min_quantity, max_quantity")
      .eq("id", data.id)
      .eq("is_active", true)
      .maybeSingle();
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); }
    if (!product) return null;
    return { ...product, image_url: await signBucketPath("products", product.image_url) } as Product;
  });

export const Route = createFileRoute("/product/$id")({
  head: ({ loaderData }) => {
    const d = loaderData as { title?: string; title_en?: string | null; description?: string | null } | undefined;
    const title = d?.title_en || d?.title;
    return {
      meta: [
        { title: title ? `${title} — Lion Store` : "Product — Lion Store" },
        { name: "description", content: d?.description ?? "" },
      ],
    };
  },
  loader: async ({ params }) => {
    const product = await getProductById({ data: { id: params.id } });
    if (!product) throw notFound();
    return product;
  },
  errorComponent: ({ error }) => (
    <AppLayout><p className="text-center py-12 text-destructive">{error.message}</p></AppLayout>
  ),
  notFoundComponent: () => (
    <AppLayout><p className="text-center py-12 text-muted-foreground">Product not found</p></AppLayout>
  ),
  component: ProductPage,
});

function ProductPage() {
  const product = Route.useLoaderData() as Product;
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const accountFn = useServerFn(getMyAccount);
  const purchaseFn = useServerFn(purchaseProduct);
  const discountFn = useServerFn(getMyProductDiscount);
  const { t, lang, dir } = useLang();
  const { format } = useCurrency();

  const account = useQuery({ queryKey: ["account"], queryFn: () => accountFn(), enabled: !!user });
  const discountQ = useQuery({
    queryKey: ["my-discount", product.id, user?.id],
    queryFn: () => discountFn({ data: { productId: product.id } }),
    enabled: !!user,
  });
  const discountPct = Number(discountQ.data?.percent ?? 0);

  const p = product;
  const title = pickLocalized(p.title, p.title_en, lang);
  const description = pickLocalized(p.description, p.description_en, lang);

  const [gameId, setGameId] = useState("");
  const [idError, setIdError] = useState(false);
  const qtyEnabled = !!p.quantity_enabled;
  const unitSize = Number(p.unit_size ?? 1) || 1;
  const unitLabel = p.unit_label ?? "";
  const minQty = p.min_quantity != null ? Number(p.min_quantity) : null;
  const maxQty = p.max_quantity != null ? Number(p.max_quantity) : null;
  const [quantity, setQuantity] = useState<string>(qtyEnabled ? String(minQty ?? unitSize) : "");
  const qtyNum = Number(quantity) || 0;
  const basePrice = qtyEnabled ? Math.round((qtyNum / unitSize) * Number(p.price) * 100) / 100 : Number(p.price);
  const totalPrice = discountPct > 0 ? Math.round(basePrice * (1 - discountPct / 100) * 100) / 100 : basePrice;
  const qtyValid = !qtyEnabled || (qtyNum > 0 && (minQty == null || qtyNum >= minQty) && (maxQty == null || qtyNum <= maxQty));
  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  const mutation = useMutation({
    mutationFn: (vars: { productId: string; gameUserId?: string; quantity?: number }) => purchaseFn({ data: vars }),
    onSuccess: () => {
      toast.success(t("تم إرسال الطلب!", "Order placed!"));
      qc.invalidateQueries({ queryKey: ["account"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      qc.invalidateQueries({ queryKey: ["my-notifications", user?.id] });
      navigate({ to: "/transactions" });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("Insufficient") ? t("رصيدك غير كافٍ.", "Insufficient balance.") :
        e.message.includes("Rate") || e.message.includes("تجاوز") ? e.message :
        e.message,
      ),
  });

  const balance = Number(account.data?.balance ?? 0);

  return (
    <AppLayout>
      <Link to="/shop" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-gold mb-4">
        <BackArrow className="size-4" /> {t("العودة للمتجر", "Back to shop")}
      </Link>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div className="rounded-3xl bg-dark-gradient border-gold p-6 shadow-card">
          <FramedImage src={p.image_url} alt={title} />
        </div>

        <div className="rounded-3xl bg-card/70 border border-border p-6 shadow-card">
          {p.is_offer && (
            <span className="inline-block text-[11px] font-extrabold bg-destructive text-destructive-foreground rounded-full px-3 py-1 mb-3">
              {t("عرض خاص", "Special offer")}
            </span>
          )}
          <h1 className="text-3xl font-black text-gold-gradient">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{p.category}</p>

          {qtyEnabled ? (
            <p className="mt-6 text-lg font-bold text-gold">
              {discountPct > 0 && (
                <span className="text-sm text-muted-foreground line-through mr-2">{format(Number(p.price))}</span>
              )}
              {format((discountPct > 0 ? Math.round(Number(p.price) * (1 - discountPct / 100) * 100) / 100 : Number(p.price)))}
              <span className="text-sm text-muted-foreground"> / {t("كل", "per")} {unitSize.toLocaleString()} {unitLabel || t("وحدة", "unit")}</span>
              {discountPct > 0 && (
                <span className="ml-2 text-xs font-extrabold bg-gold-gradient text-primary-foreground rounded-full px-2 py-0.5">-{discountPct}%</span>
              )}
            </p>
          ) : (
            <div className="mt-6">
              {discountPct > 0 && (
                <p className="text-base text-muted-foreground line-through">{format(Number(p.price))}</p>
              )}
              <p className="text-4xl font-black text-gold flex items-center gap-2">
                {format(totalPrice)}
                {discountPct > 0 && (
                  <span className="text-xs font-extrabold bg-gold-gradient text-primary-foreground rounded-full px-2 py-1">{t("خصم", "Discount")} -{discountPct}%</span>
                )}
              </p>
            </div>
          )}

          {description && (
            <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-foreground/90">{description}</p>
          )}

          {qtyEnabled && (
            <div className="mt-5">
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
                className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3"
              />
              <div className="mt-3 flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 p-3">
                <span className="text-sm text-muted-foreground">{t("الإجمالي", "Total")}</span>
                <span className="text-2xl font-black text-gold-gradient">{format(totalPrice)}</span>
              </div>
            </div>
          )}

          {user && (
            <div className="mt-6 flex items-center justify-between text-sm rounded-xl bg-secondary/40 p-3">
              <span className="text-muted-foreground flex items-center gap-1"><Wallet className="size-4" />{t("رصيدك", "Your balance")}</span>
              <span className="font-extrabold text-gold-gradient">{format(balance)}</span>
            </div>
          )}

          {user && (
            <div className="mt-4">
              <label className="text-xs font-bold mb-1 block">
                {p.category === "games" ? t("ID اللاعب", "Player ID") : t("ID الحساب / رقم التعريف", "Account ID")} <span className="text-destructive">*</span>
              </label>
              <input
                value={gameId}
                onChange={(e) => { setGameId(e.target.value); if (idError) setIdError(false); }}
                placeholder="123456789"
                className={`w-full rounded-xl bg-secondary/60 border px-4 py-3 ${idError ? "border-destructive ring-1 ring-destructive" : "border-border"}`}
              />
              {idError && (
                <p className="mt-1 text-xs font-semibold text-destructive">{t("الـ ID مفقود", "ID is missing")}</p>
              )}
            </div>
          )}

          {!user ? (
            <Link to="/login" className="mt-6 w-full block text-center rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold">
              {t("سجّل دخول للشراء", "Sign in to buy")}
            </Link>
          ) : balance < totalPrice ? (
            <Link to="/topup" className="mt-6 w-full block text-center rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold">
              {t("اشحن رصيدك أولًا", "Top up your balance first")}
            </Link>
          ) : (
            <button
              disabled={mutation.isPending || !qtyValid}
              onClick={() => {
                if (!gameId.trim()) { setIdError(true); toast.error(t("الـ ID مفقود", "ID is missing")); return; }
                mutation.mutate({ productId: p.id, gameUserId: gameId.trim(), quantity: qtyEnabled ? qtyNum : undefined });
              }}
              className="mt-6 w-full rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold disabled:opacity-50"
            >
              {mutation.isPending ? "..." : qtyEnabled ? `${t("أكد الشراء", "Confirm")} — ${format(totalPrice)}` : t("أكد الشراء", "Confirm purchase")}
            </button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
