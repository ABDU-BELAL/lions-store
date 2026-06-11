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

export const Route = createFileRoute("/collection/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Lion Store` }] }),
  errorComponent: ({ error }) => <AppLayout><p className="text-center py-12 text-destructive">{error.message}</p></AppLayout>,
  notFoundComponent: () => <AppLayout><p className="text-center py-12 text-muted-foreground">القسم غير موجود</p></AppLayout>,
  component: CollectionPage,
});

type ColProduct = { id: string; title: string; description: string | null; price: number; image_url: string | null; is_offer: boolean; category: string; quantity_enabled?: boolean; unit_size?: number; unit_label?: string | null; min_quantity?: number | null; max_quantity?: number | null };

function CollectionPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchCollection = useServerFn(getCollectionBySlug);
  const accountFn = useServerFn(getMyAccount);
  const purchaseFn = useServerFn(purchaseProduct);

  const { data, isLoading } = useQuery({
    queryKey: ["collection", slug],
    queryFn: () => fetchCollection({ data: { slug } }),
  });
  const account = useQuery({ queryKey: ["account"], queryFn: () => accountFn(), enabled: !!user });

  const [selected, setSelected] = useState<ColProduct | null>(null);
  const [gameId, setGameId] = useState("");
  const [quantity, setQuantity] = useState<string>("");

  const mutation = useMutation({
    mutationFn: (vars: { productId: string; gameUserId?: string; quantity?: number }) => purchaseFn({ data: vars }),
    onSuccess: () => {
      toast.success("تم إرسال الطلب!");
      setSelected(null); setGameId(""); setQuantity("");
      qc.invalidateQueries({ queryKey: ["account"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    },
    onError: (e: Error) => toast.error(e.message.includes("Insufficient") ? "رصيدك غير كافٍ." : e.message),
  });


  if (isLoading) return <AppLayout><p className="text-center py-12 text-muted-foreground">جاري التحميل...</p></AppLayout>;
  if (!data) return <AppLayout><p className="text-center py-12 text-muted-foreground">القسم غير موجود</p></AppLayout>;

  const balance = Number(account.data?.balance ?? 0);

  return (
    <AppLayout>
      <div className="rounded-3xl bg-dark-gradient border-gold p-6 md:p-8 shadow-card flex items-center gap-5">
        {data.collection.image_url && (
          <img src={data.collection.image_url} alt={data.collection.title} className="size-20 rounded-2xl object-cover ring-2 ring-gold/40" />
        )}
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-gold-gradient">{data.collection.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{data.products.length} منتج</p>
        </div>
      </div>

      {data.products.length === 0 && (
        <div className="mt-10 text-center text-muted-foreground">
          <ShoppingBag className="mx-auto size-12 mb-3 opacity-50" />
          <p>لا يوجد منتجات في هذا القسم بعد.</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.products.map((p) => (
          <button
            key={p.id}
            onClick={() => { if (!user) { toast.error("سجّل دخول أولًا"); return; } setSelected(p); }}
            className="group relative text-right rounded-2xl overflow-hidden bg-dark-gradient shadow-card border border-gold/20 transition-transform hover:-translate-y-1 hover:shadow-gold"
          >
            {p.is_offer && <span className="absolute top-2 right-2 z-20 text-[10px] font-extrabold bg-destructive text-destructive-foreground rounded-full px-2 py-1">عرض</span>}
            <FramedImage src={p.image_url} alt={p.title} />
            <div className="px-4 pb-4 pt-1 text-center">
              <h3 className="text-sm font-extrabold text-gold-gradient line-clamp-1">{p.title}</h3>
              {p.description && (
                <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 whitespace-pre-line">{p.description}</p>
              )}
              <p className="mt-1 text-lg font-black text-gold">EG {Number(p.price).toLocaleString()}</p>
            </div>
            <div className="absolute inset-x-0 top-0 h-1 bg-gold-gradient opacity-80" />
          </button>
        ))}
      </div>

      {selected && (() => {
        const qtyEnabled = !!selected.quantity_enabled;
        const unitSize = Number(selected.unit_size ?? 1) || 1;
        const unitLabel = selected.unit_label ?? "";
        const minQty = selected.min_quantity != null ? Number(selected.min_quantity) : null;
        const maxQty = selected.max_quantity != null ? Number(selected.max_quantity) : null;
        const qtyNum = Number(quantity) || 0;
        const total = qtyEnabled ? Math.round((qtyNum / unitSize) * Number(selected.price) * 100) / 100 : Number(selected.price);
        const qtyValid = !qtyEnabled || (qtyNum > 0 && (minQty == null || qtyNum >= minQty) && (maxQty == null || qtyNum <= maxQty));
        return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => { setSelected(null); setQuantity(""); }}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-card border-gold shadow-card p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => { setSelected(null); setQuantity(""); }} className="absolute top-3 left-3 grid place-items-center size-9 rounded-full bg-secondary"><X className="size-5" /></button>
            <h3 className="text-xl font-black text-gold-gradient text-center">تأكيد الشراء</h3>
            <div className="mt-4 rounded-2xl bg-secondary/40 p-4 text-center">
              <p className="text-sm text-muted-foreground">{selected.title}</p>
              {selected.description && (
                <p className="mt-2 text-xs text-foreground/80 whitespace-pre-line text-right">{selected.description}</p>
              )}
              {qtyEnabled ? (
                <p className="text-base font-bold text-gold mt-1">EG {Number(selected.price).toLocaleString()} <span className="text-xs text-muted-foreground">/ كل {unitSize.toLocaleString()} {unitLabel || "وحدة"}</span></p>
              ) : (
                <p className="text-3xl font-black text-gold mt-1">EG {Number(selected.price).toLocaleString()}</p>
              )}
            </div>
            {qtyEnabled && (
              <div className="mt-4">
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
                  placeholder={String(minQty ?? unitSize)}
                  className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3"
                />
                <div className="mt-3 flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 p-3">
                  <span className="text-sm text-muted-foreground">الإجمالي</span>
                  <span className="text-2xl font-black text-gold-gradient">EG {total.toLocaleString()}</span>
                </div>
              </div>
            )}
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1"><Wallet className="size-4" />رصيدك</span>
              <span className="font-extrabold text-gold-gradient">EG {balance.toLocaleString()}</span>
            </div>
            <div className="mt-4">
              <label className="text-xs font-bold mb-1 block">
                {selected.category === "games" ? "ID اللاعب" : "ID الحساب / رقم التعريف"} <span className="text-destructive">*</span>
              </label>
              <input value={gameId} onChange={(e) => setGameId(e.target.value)} placeholder="123456789" className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3" />
            </div>
            {balance < total ? (
              <Link to="/topup" className="mt-5 w-full block text-center rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold">اشحن رصيدك أولًا</Link>
            ) : (
              <button disabled={mutation.isPending || !qtyValid} onClick={() => { if (!gameId.trim()) { toast.error("من فضلك أدخل الـ ID أولًا"); return; } mutation.mutate({ productId: selected.id, gameUserId: gameId.trim(), quantity: qtyEnabled ? qtyNum : undefined }); }} className="mt-5 w-full rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold disabled:opacity-50">
                {mutation.isPending ? "..." : qtyEnabled ? `أكد الشراء — EG ${total.toLocaleString()}` : "أكد الشراء"}
              </button>
            )}
          </div>
        </div>
        );
      })()}
    </AppLayout>
  );
}

