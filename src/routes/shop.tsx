import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listShopProducts, purchaseProduct, listMyOrders } from "@/lib/shop.functions";
import { getMyAccount } from "@/lib/account.functions";
import { useAuth } from "@/hooks/useAuth";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import proframe from "@/assets/proframe.png.asset.json";
import { Wallet, X, ShoppingBag, Clock, CheckCircle2, XCircle, Search as SearchIcon } from "lucide-react";
import { z } from "zod";

const shopSearch = z.object({ q: z.string().optional().catch("") });

export const Route = createFileRoute("/shop")({
  head: () => ({ meta: [{ title: "المتجر — Lion Store" }] }),
  validateSearch: shopSearch,
  component: ShopPage,
});

type Product = Awaited<ReturnType<typeof listShopProducts>>[number];

const statusMap = {
  pending: { label: "قيد التنفيذ", icon: Clock, color: "text-gold" },
  completed: { label: "تم", icon: CheckCircle2, color: "text-emerald-400" },
  cancelled: { label: "ملغي", icon: XCircle, color: "text-destructive" },
  rejected: { label: "مرفوض", icon: XCircle, color: "text-destructive" },
} as const;

function ShopPage() {
  const { user } = useAuth();
  const { q = "" } = Route.useSearch();
  const navigate = useNavigate({ from: "/shop" });
  const qc = useQueryClient();
  const listFn = useServerFn(listShopProducts);
  const accountFn = useServerFn(getMyAccount);
  const ordersFn = useServerFn(listMyOrders);
  const purchaseFn = useServerFn(purchaseProduct);

  const products = useQuery({ queryKey: ["shop-products"], queryFn: () => listFn() });
  const account = useQuery({ queryKey: ["account"], queryFn: () => accountFn(), enabled: !!user });
  const orders = useQuery({ queryKey: ["my-orders"], queryFn: () => ordersFn(), enabled: !!user });

  const [selected, setSelected] = useState<Product | null>(null);
  const [gameId, setGameId] = useState("");

  const mutation = useMutation({
    mutationFn: (vars: { productId: string; gameUserId?: string }) => purchaseFn({ data: vars }),
    onSuccess: () => {
      toast.success("تم إرسال الطلب! هيتم تنفيذه قريبًا.");
      setSelected(null);
      setGameId("");
      qc.invalidateQueries({ queryKey: ["account"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    },
    onError: (e: Error) => {
      const msg = e.message.includes("Insufficient")
        ? "رصيدك غير كافٍ. اشحن الرصيد أولًا."
        : e.message.includes("Not authenticated")
        ? "سجّل دخول أولًا."
        : e.message;
      toast.error(msg);
    },
  });

  const balance = Number(account.data?.balance ?? 0);
  const allList = products.data ?? [];
  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return allList;
    return allList.filter((p) =>
      p.title.toLowerCase().includes(query) ||
      (p.description ?? "").toLowerCase().includes(query) ||
      (p.category ?? "").toLowerCase().includes(query),
    );
  }, [allList, q]);

  return (
    <AppLayout>
      <div className="rounded-3xl bg-dark-gradient border-gold p-6 shadow-card flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gold-gradient">المتجر</h1>
          <p className="text-muted-foreground text-sm mt-1">اشترِ بالرصيد مباشرة — التنفيذ خلال دقائق.</p>
        </div>
        {user && (
          <Link to="/topup" className="hidden sm:flex items-center gap-2 rounded-2xl border-gold bg-gradient-to-l from-gold-deep/30 to-gold/10 px-4 py-3">
            <Wallet className="size-5 text-gold" />
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">رصيدك</p>
              <p className="text-sm font-black text-gold-gradient">EG {balance.toLocaleString()}</p>
            </div>
          </Link>
        )}
      </div>

      <div className="mt-5 relative">
        <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 size-5 text-gold" />
        <input
          value={q}
          onChange={(e) => navigate({ search: { q: e.target.value || undefined }, replace: true })}
          placeholder="ابحث داخل المتجر..."
          className="w-full rounded-full bg-secondary/60 border border-border pr-12 pl-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
        />
      </div>

      {products.isLoading && <p className="mt-8 text-center text-muted-foreground">جاري التحميل...</p>}
      {!products.isLoading && list.length === 0 && (
        <div className="mt-10 text-center text-muted-foreground">
          <ShoppingBag className="mx-auto size-12 mb-3 opacity-50" />
          <p>{q ? "لا توجد نتائج لبحثك" : "لا توجد منتجات حاليًا. الأدمن لسه مضاف منتجات."}</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {list.map((p) => (
          <div key={p.id} className="group relative rounded-2xl overflow-hidden bg-dark-gradient shadow-card border border-gold/20 transition-transform hover:-translate-y-1 hover:shadow-gold">
            {p.is_offer && (
              <span className="absolute top-2 right-2 z-20 text-[10px] font-extrabold bg-destructive text-destructive-foreground rounded-full px-2 py-1">عرض</span>
            )}
            <button
              type="button"
              onClick={() => {
                if (!user) { toast.error("سجّل دخول أولًا"); return; }
                setSelected(p);
              }}
              className="block w-full text-right"
            >
              <div className="relative aspect-square p-6 flex items-center justify-center">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_oklch(0.7_0.18_75/_18%),_transparent_65%)]" />
                <div className="relative w-full h-full grid place-items-center">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.title} className="absolute inset-[18%] w-[64%] h-[64%] object-cover rounded-2xl z-10" />
                  ) : (
                    <div className="absolute inset-[18%] w-[64%] h-[64%] grid place-items-center rounded-2xl bg-secondary z-10 text-3xl">🎮</div>
                  )}
                  <img src={proframe.url} alt="" aria-hidden className="relative w-full h-full object-contain drop-shadow-[0_0_20px_oklch(0.7_0.18_75/_40%)]" />
                </div>
              </div>
              <div className="px-4 pt-1 text-center">
                <h3 className="text-sm font-extrabold text-gold-gradient line-clamp-1">{p.title}</h3>
                <p className="mt-1 text-lg font-black text-gold">EG {Number(p.price).toLocaleString()}</p>
              </div>
            </button>
            <div className="px-4 pb-4 pt-2 text-center">
              <Link to="/product/$id" params={{ id: p.id }} className="text-[11px] text-muted-foreground hover:text-gold underline">
                التفاصيل
              </Link>
            </div>
            <div className="absolute inset-x-0 top-0 h-1 bg-gold-gradient opacity-80" />
          </div>
        ))}
      </div>


      {/* History */}
      {user && (orders.data ?? []).length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-extrabold text-gold-gradient">طلباتك</h2>
          <div className="mt-3 rounded-2xl overflow-hidden border border-border bg-card/70">
            {(orders.data ?? []).map((o, i) => {
              const s = statusMap[o.status as keyof typeof statusMap] ?? statusMap.pending;
              return (
                <div key={o.id} className={`flex items-center justify-between gap-3 p-4 ${i ? "border-t border-border" : ""}`}>
                  <div className="flex items-center gap-3">
                    <s.icon className={`size-5 ${s.color}`} />
                    <div>
                      <p className="font-extrabold text-sm">{o.product_title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("ar-EG")}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-extrabold">EG {Number(o.amount).toLocaleString()}</p>
                    <p className={`text-xs font-bold ${s.color}`}>{s.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Purchase modal */}
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-card border-gold shadow-card p-6 relative">
            <button onClick={() => setSelected(null)} className="absolute top-3 left-3 grid place-items-center size-9 rounded-full bg-secondary hover:bg-secondary/70">
              <X className="size-5" />
            </button>
            <h3 className="text-xl font-black text-gold-gradient text-center">تأكيد الشراء</h3>
            <div className="mt-4 rounded-2xl bg-secondary/40 p-4 text-center">
              <p className="text-sm text-muted-foreground">{selected.title}</p>
              <p className="text-3xl font-black text-gold mt-1">EG {Number(selected.price).toLocaleString()}</p>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">رصيدك الحالي</span>
              <span className="font-extrabold text-gold-gradient">EG {balance.toLocaleString()}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">الرصيد بعد الشراء</span>
              <span className={`font-extrabold ${balance - Number(selected.price) < 0 ? "text-destructive" : "text-emerald-400"}`}>
                EG {(balance - Number(selected.price)).toLocaleString()}
              </span>
            </div>

            {selected.category === "games" && (
              <div className="mt-4">
                <label className="text-xs font-bold mb-1 block">ID اللاعب (اختياري)</label>
                <input
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  placeholder="مثلاً: 123456789"
                  className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold/50"
                />
              </div>
            )}

            {balance < Number(selected.price) ? (
              <Link
                to="/topup"
                className="mt-5 w-full block text-center rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold"
              >
                اشحن رصيدك أولًا
              </Link>
            ) : (
              <button
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ productId: selected.id, gameUserId: gameId.trim() || undefined })}
                className="mt-5 w-full rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-3 shadow-gold disabled:opacity-50"
              >
                {mutation.isPending ? "جاري التنفيذ..." : "أكد الشراء"}
              </button>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
