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
import { Wallet, ArrowRight } from "lucide-react";

export const getProductById = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: product, error } = await supabaseAdmin
      .from("products")
      .select("id, title, description, category, price, image_url, is_offer, collection_id, quantity_enabled, unit_size, unit_label, min_quantity, max_quantity")
      .eq("id", data.id)
      .eq("is_active", true)
      .maybeSingle();
    if (error) { console.error("[db]", error); throw new Error("حدث خطأ، حاول مرة أخرى"); };
    if (!product) return null;
    return { ...product, image_url: await signBucketPath("products", product.image_url) };
  });


export const Route = createFileRoute("/product/$id")({
  head: ({ loaderData }) => {
    const d = loaderData as { title?: string; description?: string | null } | undefined;
    return {
      meta: [
        { title: d?.title ? `${d.title} — Lion Store` : "منتج — Lion Store" },
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
    <AppLayout><p className="text-center py-12 text-muted-foreground">المنتج غير موجود</p></AppLayout>
  ),
  component: ProductPage,
});

function ProductPage() {
  const product = Route.useLoaderData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const accountFn = useServerFn(getMyAccount);
  const purchaseFn = useServerFn(purchaseProduct);
  const discountFn = useServerFn(getMyProductDiscount);

  const account = useQuery({ queryKey: ["account"], queryFn: () => accountFn(), enabled: !!user });
  const discountQ = useQuery({
    queryKey: ["my-discount", product.id, user?.id],
    queryFn: () => discountFn({ data: { productId: product.id } }),
    enabled: !!user,
  });
  const discountPct = Number(discountQ.data?.percent ?? 0);

  const [gameId, setGameId] = useState("");
  const qtyEnabled = !!(product as any).quantity_enabled;
  const unitSize = Number((product as any).unit_size ?? 1) || 1;
  const unitLabel = (product as any).unit_label ?? "";
  const minQty = (product as any).min_quantity != null ? Number((product as any).min_quantity) : null;
  const maxQty = (product as any).max_quantity != null ? Number((product as any).max_quantity) : null;
  const [quantity, setQuantity] = useState<string>(qtyEnabled ? String(minQty ?? unitSize) : "");
  const qtyNum = Number(quantity) || 0;
  const basePrice = qtyEnabled ? Math.round((qtyNum / unitSize) * Number(product.price) * 100) / 100 : Number(product.price);
  const totalPrice = discountPct > 0 ? Math.round(basePrice * (1 - discountPct / 100) * 100) / 100 : basePrice;
  const qtyValid = !qtyEnabled || (qtyNum > 0 && (minQty == null || qtyNum >= minQty) && (maxQty == null || qtyNum <= maxQty));


  const mutation = useMutation({
    mutationFn: (vars: { productId: string; gameUserId?: string; quantity?: number }) => purchaseFn({ data: vars }),
    onSuccess: () => {
      toast.success("تم إرسال الطلب!");
      qc.invalidateQueries({ queryKey: ["account"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      navigate({ to: "/transactions" });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("Insufficient") ? "رصيدك غير كافٍ." :
        e.message.includes("Rate") || e.message.includes("تجاوز") ? e.message :
        e.message,
      ),
  });


  const balance = Number(account.data?.balance ?? 0);

  return (
    <AppLayout>
      <Link to="/shop" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-gold mb-4">
        <ArrowRight className="size-4" /> العودة للمتجر
      </Link>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div className="rounded-3xl bg-dark-gradient border-gold p-6 shadow-card">
          <FramedImage src={product.image_url} alt={product.title} />
        </div>

        <div className="rounded-3xl bg-card/70 border border-border p-6 shadow-card">
          {product.is_offer && (
            <span className="inline-block text-[11px] font-extrabold bg-destructive text-destructive-foreground rounded-full px-3 py-1 mb-3">
              عرض خاص
            </span>
          )}
          <h1 className="text-3xl font-black text-gold-gradient">{product.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{product.category}</p>

          {qtyEnabled ? (
            <p className="mt-6 text-lg font-bold text-gold">
              {discountPct > 0 && (
                <span className="text-sm text-muted-foreground line-through mr-2">EG {Number(product.price).toLocaleString()}</span>
              )}
              EG {(discountPct > 0 ? Math.round(Number(product.price) * (1 - discountPct / 100) * 100) / 100 : Number(product.price)).toLocaleString()}
              <span className="text-sm text-muted-foreground"> / كل {unitSize.toLocaleString()} {unitLabel || "وحدة"}</span>
              {discountPct > 0 && (
                <span className="ml-2 text-xs font-extrabold bg-gold-gradient text-primary-foreground rounded-full px-2 py-0.5">-{discountPct}%</span>
              )}
            </p>
          ) : (
            <div className="mt-6">
              {discountPct > 0 && (
                <p className="text-base text-muted-foreground line-through">EG {Number(product.price).toLocaleString()}</p>
              )}
              <p className="text-4xl font-black text-gold flex items-center gap-2">
                EG {totalPrice.toLocaleString()}
                {discountPct > 0 && (
                  <span className="text-xs font-extrabold bg-gold-gradient text-primary-foreground rounded-full px-2 py-1">خصم -{discountPct}%</span>
                )}
              </p>
            </div>
          )}


          {product.description && (
            <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-foreground/90">{product.description}</p>
          )}

          {qtyEnabled && (
            <div className="mt-5">
              <label className="text-xs font-bold mb-1 block">
                الكمية {unitLabel ? `(${unitLabel})` : ""}
                {minQty != null && <span className="text-muted-foreground"> — حد أدنى {minQty.toLocaleString()}</span>}
                {maxQty != null && <span className="text-muted-foreground"> — حد أقصى {maxQty.toLocaleString()}</span>}
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
                <span className="text-sm text-muted-foreground">الإجمالي</span>
                <span className="text-2xl font-black text-gold-gradient">EG {totalPrice.toLocaleString()}</span>
              </div>
            </div>
          )}

          {user && (
            <div className="mt-6 flex items-center justify-between text-sm rounded-xl bg-secondary/40 p-3">
              <span className="text-muted-foreground flex items-center gap-1"><Wallet className="size-4" />رصيدك</span>
              <span className="font-extrabold text-gold-gradient">EG {balance.toLocaleString()}</span>
            </div>
          )}

          {user && (
            <div className="mt-4">
              <label className="text-xs font-bold mb-1 block">
                {product.category === "games" ? "ID اللاعب" : "ID الحساب / رقم التعريف"} <span className="text-destructive">*</span>
              </label>
              <input
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                placeholder="123456789"
                className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3"
              />
            </div>
          )}

          {!user ? (
            <Link to="/login" className="mt-6 w-full block text-center rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold">
              سجّل دخول للشراء
            </Link>
          ) : balance < totalPrice ? (
            <Link to="/topup" className="mt-6 w-full block text-center rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold">
              اشحن رصيدك أولًا
            </Link>
          ) : (
            <button
              disabled={mutation.isPending || !qtyValid}
              onClick={() => {
                if (!gameId.trim()) { toast.error("من فضلك أدخل الـ ID أولًا"); return; }
                mutation.mutate({ productId: product.id, gameUserId: gameId.trim(), quantity: qtyEnabled ? qtyNum : undefined });
              }}
              className="mt-6 w-full rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold disabled:opacity-50"
            >
              {mutation.isPending ? "..." : qtyEnabled ? `أكد الشراء — EG ${totalPrice.toLocaleString()}` : "أكد الشراء"}
            </button>
          )}

        </div>
      </div>
    </AppLayout>
  );
}
