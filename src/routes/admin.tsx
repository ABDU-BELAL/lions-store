import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAccount } from "@/lib/account.functions";
import {
  getAdminStats, listAllTopups, decideTopup,
  adminListProducts, adminUpsertProduct, adminDeleteProduct,
  listAdmins, grantAdmin, revokeAdmin, claimSuperAdmin,
  verifyAdminAccess, adminListOrders, decideOrder,
  adminListUsers, adminAdjustBalance, adminSetUserBanned,
  adminListDiscounts, adminUpsertDiscount, adminDeleteDiscount,
  adminBrand1TestConnection, adminBrand1ListProducts, adminSetProductProvider, adminX3TestConnection, adminX3ListProducts,
} from "@/lib/admin.functions";
import { listVipTiers, adminUpdateVipTier, adminAssignVip, adminRevokeVip } from "@/lib/vip.functions";
import { VipBadge } from "@/components/VipBadge";


import { adminListBanners, adminUpsertBanner, adminDeleteBanner, adminUploadBannerImage } from "@/lib/banners.functions";
import {
  adminListCollections, adminUpsertCollection, adminDeleteCollection,
  adminUploadProductImage, getHomeSettings, adminUpdateHomeSettings,
} from "@/lib/collections.functions";
import { getPaymentMethods, adminUpdatePaymentMethods } from "@/lib/topup.functions";
import { useState } from "react";
import { toast } from "sonner";
import { Users, Wallet, ShoppingBag, Package, CheckCircle2, XCircle, Trash2, Plus, Crown, Shield, Image as ImageIcon, Upload, Settings as SettingsIcon, Layers } from "lucide-react";
import { useCurrency } from "@/i18n/CurrencyProvider";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "لوحة الأدمن — Lion Store" }] }),
  beforeLoad: async () => {
    // Server-side validated guard: throws Unauthorized/Forbidden if the
    // current user is not an admin, and the route never renders.
    try {
      const access = await verifyAdminAccess();
      return { adminAccess: access };
    } catch {
      throw redirect({ to: "/" });
    }
  },
  component: AdminPage,
});

type Tab = "stats" | "topups" | "orders" | "products" | "collections" | "banners" | "settings" | "payments" | "users" | "discounts" | "vip" | "admins";

function AdminPage() {
  const { user, loading } = useAuth();
  const getAccount = useServerFn(getMyAccount);
  const account = useQuery({
    queryKey: ["account", user?.id],
    queryFn: () => getAccount(),
    enabled: !!user,
    refetchOnMount: "always",
  });
  const [tab, setTab] = useState<Tab>("stats");

  if (!loading && !user) throw redirect({ to: "/login" });

  if (loading || account.isLoading) return <AppLayout><p className="text-center py-12 text-muted-foreground">جاري تحميل الصلاحيات...</p></AppLayout>;

  if (!account.data?.isAdmin) return <NoAccess hasUser={!!user} />;

  return (
    <AppLayout>
      <div className="flex items-center gap-3 mb-5">
        <div className="grid place-items-center size-12 rounded-2xl bg-gold-gradient text-primary-foreground"><Crown className="size-6" /></div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gold-gradient">لوحة الأدمن</h1>
          <p className="text-xs text-muted-foreground">{account.data.isSuperAdmin ? "Super Admin" : "Admin"}</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
        {([
          { id: "stats", label: "الإحصائيات" },
          { id: "topups", label: "طلبات الشحن" },
          { id: "orders", label: "الطلبات" },
          { id: "collections", label: "الأقسام" },
          { id: "products", label: "المنتجات" },
          { id: "banners", label: "السلايدر" },
          { id: "settings", label: "الصفحة الرئيسية" },
          ...(account.data.isSuperAdmin ? [{ id: "payments" as Tab, label: "وسائل الدفع" }] : []),
          ...(account.data.isSuperAdmin ? [{ id: "users" as Tab, label: "المستخدمين" }] : []),
          ...(account.data.isSuperAdmin ? [{ id: "discounts" as Tab, label: "الخصومات" }] : []),
          ...(account.data.isSuperAdmin ? [{ id: "vip" as Tab, label: "VIP" }] : []),
          { id: "admins", label: "الأدمنز" },



        ] as { id: Tab; label: string }[]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition ${tab === t.id ? "bg-gold-gradient text-primary-foreground shadow-gold" : "bg-card border border-border"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "stats" && <StatsTab />}
      {tab === "topups" && <TopupsTab />}
      {tab === "orders" && <OrdersTab />}
      {tab === "collections" && <CollectionsTab />}
      {tab === "products" && <ProductsTab />}
      {tab === "banners" && <BannersTab />}
      {tab === "settings" && <SettingsTab isSuper={!!account.data.isSuperAdmin} />}
      {tab === "payments" && account.data.isSuperAdmin && <PaymentMethodsTab />}
      {tab === "users" && account.data.isSuperAdmin && <UsersTab />}
      {tab === "discounts" && account.data.isSuperAdmin && <DiscountsTab />}
      {tab === "vip" && account.data.isSuperAdmin && <VipTab />}
      {tab === "admins" && <AdminsTab isSuper={!!account.data.isSuperAdmin} />}


    </AppLayout>
  );
}

function NoAccess({ hasUser }: { hasUser: boolean }) {
  const claim = useServerFn(claimSuperAdmin);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => claim(),
    onSuccess: () => { toast.success("تم! انت دلوقتي مالك النظام."); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="rounded-3xl bg-dark-gradient border-gold p-8 text-center max-w-lg mx-auto">
        <Shield className="mx-auto size-12 text-gold mb-3" />
        <h1 className="text-2xl font-black text-gold-gradient">منطقة الأدمن</h1>
        <p className="mt-3 text-muted-foreground">معندكش صلاحيات وصول. لو ده أول أدمن في النظام، تقدر تطالب بصلاحية المالك دلوقتي:</p>
        {hasUser && (
          <button onClick={() => m.mutate()} disabled={m.isPending} className="mt-5 rounded-full bg-gold-gradient text-primary-foreground font-extrabold px-6 py-2.5 shadow-gold disabled:opacity-50">
            {m.isPending ? "..." : "أنا المالك"}
          </button>
        )}
      </div>
    </AppLayout>
  );
}

function StatsTab() {
  const fn = useServerFn(getAdminStats);
  const { data } = useQuery({ queryKey: ["admin-stats"], queryFn: () => fn() });
  const items = [
    { label: "المستخدمين", value: data?.users ?? 0, icon: Users },
    { label: "الإيرادات (EGP)", value: Math.round(Number(data?.revenue ?? 0)).toLocaleString(), icon: Wallet },
    { label: "إجمالي الطلبات", value: data?.orders ?? 0, icon: ShoppingBag },
    { label: "طلبات شحن معلقة", value: data?.pendingTopups ?? 0, icon: Wallet },
    { label: "عدد المنتجات", value: data?.products ?? 0, icon: Package },
  ];
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((s) => (
        <div key={s.label} className="rounded-2xl bg-dark-gradient border-gold p-5">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center size-11 rounded-xl bg-gold-gradient text-primary-foreground"><s.icon className="size-5" /></div>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
          <p className="mt-3 text-3xl font-black text-gold-gradient">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function TopupsTab() {
  const list = useServerFn(listAllTopups);
  const decide = useServerFn(decideTopup);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const { data } = useQuery({
    queryKey: ["admin-topups", filter],
    queryFn: () => list({ data: filter === "all" ? {} : { status: filter } }),
  });

  const m = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected"; adminNote?: string }) => decide({ data: v }),
    onSuccess: () => { toast.success("تم"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-bold ${filter === f ? "bg-gold-gradient text-primary-foreground" : "bg-secondary"}`}>
            {f === "pending" ? "معلقة" : f === "approved" ? "مقبولة" : f === "rejected" ? "مرفوضة" : "الكل"}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {(data ?? []).length === 0 && <p className="text-center py-8 text-muted-foreground">لا توجد طلبات</p>}
        {(data ?? []).map((t) => (
          <div key={t.id} className="rounded-2xl bg-card/70 border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-extrabold">{t.profile?.full_name || "—"} <span className="text-xs text-muted-foreground">({t.profile?.phone || t.profile?.email || "—"})</span></p>
                <p className="mt-1 text-2xl font-black text-gold-gradient">EG {Number(t.amount).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{t.method} • {new Date(t.created_at).toLocaleString("ar-EG")}</p>
                <p className="mt-1 text-sm">مرجع: <span className="font-mono">{t.reference}</span></p>
                {t.note && <p className="text-xs text-muted-foreground mt-1">ملاحظة العميل: {t.note}</p>}
              </div>
              {t.status === "pending" ? (
                <div className="flex gap-2">
                  <button onClick={() => m.mutate({ id: t.id, decision: "approved" })} className="rounded-lg bg-emerald-600 text-white font-bold px-3 py-2 text-sm flex items-center gap-1">
                    <CheckCircle2 className="size-4" /> قبول
                  </button>
                  <button onClick={() => { const note = prompt("سبب الرفض (اختياري)") ?? undefined; m.mutate({ id: t.id, decision: "rejected", adminNote: note || undefined }); }} className="rounded-lg bg-destructive text-white font-bold px-3 py-2 text-sm flex items-center gap-1">
                    <XCircle className="size-4" /> رفض
                  </button>
                </div>
              ) : (
                <span className={`text-xs font-bold ${t.status === "approved" ? "text-emerald-400" : "text-destructive"}`}>{t.status === "approved" ? "مقبول" : "مرفوض"}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrdersTab() {
  const list = useServerFn(adminListOrders);
  const decide = useServerFn(decideOrder);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "completed" | "rejected" | "all">("pending");
  const { data } = useQuery({
    queryKey: ["admin-orders", filter],
    queryFn: () => list({ data: filter === "all" ? {} : { status: filter } }),
  });

  const m = useMutation({
    mutationFn: (v: { id: string; decision: "completed" | "rejected" }) => decide({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.decision === "completed" ? "تم تنفيذ الطلب" : "تم رفض الطلب وإرجاع المبلغ للعميل");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(["pending", "completed", "rejected", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-bold ${filter === f ? "bg-gold-gradient text-primary-foreground" : "bg-secondary"}`}>
            {f === "pending" ? "معلقة" : f === "completed" ? "مكتملة" : f === "rejected" ? "مرفوضة" : "الكل"}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {(data ?? []).length === 0 && <p className="text-center py-8 text-muted-foreground">لا توجد طلبات</p>}
        {(data ?? []).map((o) => (
          <div key={o.id} className="rounded-2xl bg-card/70 border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-extrabold">{o.profile?.full_name || "—"} <span className="text-xs text-muted-foreground">({o.profile?.phone || o.profile?.email || "—"})</span></p>
                <p className="mt-1 font-bold">{o.product_title}</p>
                <p className="mt-1 text-2xl font-black text-gold-gradient">EG {Number(o.amount).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("ar-EG")}</p>
                {o.game_user_id && <p className="text-sm mt-1">🆔 <span className="font-mono">{o.game_user_id}</span></p>}
              </div>
              {o.status === "pending" ? (
                <div className="flex gap-2">
                  <button disabled={m.isPending} onClick={() => m.mutate({ id: o.id, decision: "completed" })} className="rounded-lg bg-emerald-600 text-white font-bold px-3 py-2 text-sm flex items-center gap-1 disabled:opacity-50">
                    <CheckCircle2 className="size-4" /> تم
                  </button>
                  <button disabled={m.isPending} onClick={() => { if (confirm("سيتم رفض الطلب وإرجاع المبلغ للعميل. متأكد؟")) m.mutate({ id: o.id, decision: "rejected" }); }} className="rounded-lg bg-destructive text-white font-bold px-3 py-2 text-sm flex items-center gap-1 disabled:opacity-50">
                    <XCircle className="size-4" /> رفض + استرداد
                  </button>
                </div>
              ) : (
                <span className={`text-xs font-bold ${o.status === "completed" ? "text-emerald-400" : "text-destructive"}`}>
                  {o.status === "completed" ? "مكتمل" : o.status === "rejected" ? "مرفوض" : o.status}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



async function fileToBase64(file: File): Promise<{ base64: string; contentType: string; filename: string }> {
  const buf = await file.arrayBuffer();
  let bin = ""; const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return { base64: btoa(bin), contentType: file.type || "image/jpeg", filename: file.name };
}

function ImageUploadField({ value, previewUrl, onChange, label = "اختر صورة (حتى 5MB)" }: { value: string; previewUrl?: string; onChange: (path: string) => void; label?: string }) {
  const upload = useServerFn(adminUploadProductImage);
  const [busy, setBusy] = useState(false);
  const handle = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("الصورة أكبر من 5MB"); return; }
    setBusy(true);
    try {
      const payload = await fileToBase64(file);
      const { path } = await upload({ data: payload });
      onChange(path);
      toast.success("تم رفع الصورة");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <label className="block">
        <div className="rounded-xl border-2 border-dashed border-gold/40 bg-secondary/50 p-4 text-center cursor-pointer hover:border-gold transition">
          <Upload className="mx-auto size-6 text-gold mb-1" />
          <p className="text-sm font-bold">{busy ? "جاري الرفع..." : label}</p>
        </div>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} />
      </label>
      {value && (
        <div className="mt-2 flex items-center gap-2">
          {previewUrl && previewUrl.startsWith("http") ? (
            <img src={previewUrl} alt="" className="size-16 object-cover rounded-lg border border-border" />
          ) : (
            <p className="text-xs text-emerald-400 font-bold">✓ تم رفع صورة</p>
          )}
          <button type="button" onClick={() => onChange("")} className="text-xs text-destructive hover:underline">إزالة</button>
        </div>
      )}
    </div>
  );
}

function ProductsTab({ initialCollectionId, onBack }: { initialCollectionId?: string | null; onBack?: () => void } = {}) {
  const list = useServerFn(adminListProducts);
  const upsert = useServerFn(adminUpsertProduct);
  const del = useServerFn(adminDeleteProduct);
  const colsList = useServerFn(adminListCollections);
  const testBrand1 = useServerFn(adminBrand1TestConnection);
  const listBrand1 = useServerFn(adminBrand1ListProducts);
  const testX3 = useServerFn(adminX3TestConnection);
  const listX3 = useServerFn(adminX3ListProducts);
  const setProvider = useServerFn(adminSetProductProvider);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-products"], queryFn: () => list() });
  const { data: collections = [] } = useQuery({ queryKey: ["admin-collections"], queryFn: () => colsList() });
  const [filter, setFilter] = useState<string>(initialCollectionId ?? "");
  type EditState = { id?: string; title: string; title_en: string; description: string; description_en: string; image_url: string; category: string; price: number; is_active: boolean; in_stock: boolean; is_offer: boolean; sort_order: number; collection_id: string | null; quantity_enabled: boolean; unit_size: number; unit_label: string; min_quantity: string; max_quantity: string; provider: "" | "brand1" | "x3"; provider_product_id: string; auto_fulfill_enabled: boolean; purchase_field_mode: "game_id" | "subscription" | "link" | "none" };
  const [editing, setEditing] = useState<null | EditState>(null);

  const blank = (): EditState => ({ title: "", title_en: "", description: "", description_en: "", image_url: "", category: "games", price: 0, is_active: true, in_stock: true, is_offer: false, sort_order: 0, collection_id: filter || null, quantity_enabled: false, unit_size: 1, unit_label: "", min_quantity: "", max_quantity: "", provider: "", provider_product_id: "", auto_fulfill_enabled: false, purchase_field_mode: "game_id" });

  const save = useMutation({
    mutationFn: async () => {
      await upsert({ data: { id: editing?.id, data: {
        title: editing!.title,
        title_en: editing!.title_en.trim() || null,
        description: editing!.description || undefined,
        description_en: editing!.description_en.trim() || null,
        image_url: editing!.image_url || undefined,
        category: editing!.category, price: editing!.price, is_active: editing!.is_active, in_stock: editing!.in_stock, is_offer: editing!.is_offer, sort_order: editing!.sort_order,
        collection_id: editing!.collection_id || null,
        quantity_enabled: editing!.quantity_enabled,
        unit_size: editing!.quantity_enabled ? Number(editing!.unit_size) || 1 : 1,
        unit_label: editing!.quantity_enabled ? (editing!.unit_label.trim() || null) : null,
        min_quantity: editing!.quantity_enabled && editing!.min_quantity ? Number(editing!.min_quantity) : null,
        max_quantity: editing!.quantity_enabled && editing!.max_quantity ? Number(editing!.max_quantity) : null,
        purchase_field_mode: editing!.purchase_field_mode,
      } } });
      if (editing?.id) {
        await setProvider({ data: {
          productId: editing.id,
          provider: editing.provider || null,
          providerProductId: editing.provider_product_id.trim() || null,
          autoFulfillEnabled: editing.auto_fulfill_enabled,
        } });
      }
    },
    onSuccess: () => { toast.success("تم الحفظ / Saved"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-products"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const testConn = useMutation({
    mutationFn: () => testBrand1({ data: undefined }),
    onSuccess: (r) => {
      if (r.ok) toast.success("اتصال Brand1 يعمل ✓");
      else toast.error("فشل Brand1: " + (r.error ?? "تأكد من السماح لكل الـ IPs"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testConnX3 = useMutation({
    mutationFn: () => testX3({ data: undefined }),
    onSuccess: (r) => {
      if (r.ok) toast.success("اتصال X3 يعمل ✓");
      else toast.error("فشل X3: " + (r.error ?? "تأكد من التوكن والـ IPs"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const brand1Products = useQuery({
    queryKey: ["brand1-products"],
    queryFn: () => listBrand1(),
    enabled: !!editing?.id && editing?.provider === "brand1",
    staleTime: 5 * 60_000,
  });

  const x3Products = useQuery({
    queryKey: ["x3-products"],
    queryFn: () => listX3(),
    enabled: !!editing?.id && editing?.provider === "x3",
    staleTime: 5 * 60_000,
  });



  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["admin-products"] }); },
  });

  const visible = (data ?? []).filter((p) => !filter || p.collection_id === filter);
  const scopedCollection = initialCollectionId ? collections.find((c) => c.id === initialCollectionId) : null;

  return (
    <div>
      {onBack && (
        <button onClick={onBack} className="mb-3 text-sm text-gold hover:underline">← رجوع للأقسام</button>
      )}
      {scopedCollection && (
        <div className="mb-4 p-3 rounded-xl bg-gold/10 border border-gold/30">
          <p className="text-sm">إدارة منتجات قسم: <span className="font-extrabold text-gold-gradient">{scopedCollection.title}</span></p>
        </div>
      )}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={() => setEditing(blank())} className="rounded-full bg-gold-gradient text-primary-foreground font-bold px-4 py-2 text-sm flex items-center gap-2"><Plus className="size-4" /> منتج جديد</button>
        <button onClick={() => testConn.mutate()} disabled={testConn.isPending} className="rounded-full bg-secondary border border-border px-4 py-2 text-sm font-bold">
          {testConn.isPending ? "..." : "اختبار Brand1"}
        </button>
        <button onClick={() => testConnX3.mutate()} disabled={testConnX3.isPending} className="rounded-full bg-secondary border border-border px-4 py-2 text-sm font-bold">
          {testConnX3.isPending ? "..." : "اختبار X3"}
        </button>
        {!initialCollectionId && (
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-full bg-secondary border border-border px-3 py-2 text-sm">
            <option value="">كل المنتجات</option>
            {collections.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        )}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((p) => (
          <div key={p.id} className="rounded-2xl bg-card/70 border border-border p-4">
            {p.image_url && <img src={p.image_url} alt={p.title} className="aspect-video w-full object-cover rounded-xl mb-2" />}
            <p className="font-extrabold">{p.title}</p>
            <p className="text-xs text-muted-foreground">{p.category} • {p.is_active ? "مفعّل" : "متوقف"}{(p as { in_stock?: boolean }).in_stock === false ? " • نفد المخزون" : ""}{p.is_offer ? " • عرض" : ""}</p>
            <p className="mt-1 font-black text-gold-gradient">EG {Number(p.price).toLocaleString()}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setEditing({ id: p.id, title: p.title, title_en: (p as { title_en?: string | null }).title_en ?? "", description: p.description ?? "", description_en: (p as { description_en?: string | null }).description_en ?? "", image_url: p.image_url ?? "", category: p.category, price: Number(p.price), is_active: p.is_active, in_stock: (p as { in_stock?: boolean }).in_stock ?? true, is_offer: p.is_offer, sort_order: p.sort_order, collection_id: p.collection_id ?? null, quantity_enabled: (p as { quantity_enabled?: boolean }).quantity_enabled ?? false, unit_size: Number((p as { unit_size?: number }).unit_size ?? 1), unit_label: (p as { unit_label?: string | null }).unit_label ?? "", min_quantity: (p as { min_quantity?: number | null }).min_quantity != null ? String((p as { min_quantity?: number | null }).min_quantity) : "", max_quantity: (p as { max_quantity?: number | null }).max_quantity != null ? String((p as { max_quantity?: number | null }).max_quantity) : "", provider: (((p as { provider?: string | null }).provider === "brand1" || (p as { provider?: string | null }).provider === "x3") ? (p as { provider?: "brand1"|"x3" }).provider! : ""), provider_product_id: (p as { provider_product_id?: string | null }).provider_product_id ?? "", auto_fulfill_enabled: (p as { auto_fulfill_enabled?: boolean }).auto_fulfill_enabled ?? false, purchase_field_mode: (((p as { purchase_field_mode?: string }).purchase_field_mode as "game_id" | "subscription" | "link" | "none") ?? "game_id") })} className="flex-1 rounded-lg bg-secondary py-1.5 text-sm font-bold">تعديل / Edit</button>
              <button onClick={() => confirm("متأكد؟") && remove.mutate(p.id)} className="rounded-lg bg-destructive text-white px-3 py-1.5 text-sm font-bold"><Trash2 className="size-4" /></button>
            </div>
          </div>
        ))}
        {visible.length === 0 && <p className="col-span-full text-center py-8 text-muted-foreground">لا يوجد منتجات. أضف أول واحد!</p>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="w-full max-w-lg bg-card border-gold rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-extrabold text-gold-gradient">{editing.id ? "تعديل منتج / Edit product" : "منتج جديد / New product"}</h3>
            <input required placeholder="الاسم بالعربية (Arabic title)" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full rounded-xl bg-secondary px-3 py-2" />
            <input placeholder="English title (optional)" value={editing.title_en} onChange={(e) => setEditing({ ...editing, title_en: e.target.value })} dir="ltr" className="w-full rounded-xl bg-secondary px-3 py-2" />
            <textarea placeholder="الوصف بالعربية (Arabic description)" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} className="w-full rounded-xl bg-secondary px-3 py-2" />
            <textarea placeholder="English description (optional)" value={editing.description_en} onChange={(e) => setEditing({ ...editing, description_en: e.target.value })} dir="ltr" rows={2} className="w-full rounded-xl bg-secondary px-3 py-2" />
            <ImageUploadField value={editing.image_url} previewUrl={editing.image_url} onChange={(v) => setEditing({ ...editing, image_url: v })} />
            <div className="grid grid-cols-2 gap-2">
              <select value={editing.collection_id ?? ""} onChange={(e) => setEditing({ ...editing, collection_id: e.target.value || null })} className="rounded-xl bg-secondary px-3 py-2">
                <option value="">بدون قسم</option>
                {collections.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="rounded-xl bg-secondary px-3 py-2">
                <option value="games">ألعاب</option>
                <option value="apps">تطبيقات</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            <input type="number" required min={0} step="0.01" placeholder={editing.quantity_enabled ? `السعر لكل ${editing.unit_size || 1} ${editing.unit_label || "وحدة"}` : "السعر"} value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className="w-full rounded-xl bg-secondary px-3 py-2" />

            <div className="rounded-xl border border-border bg-secondary/40 p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={editing.quantity_enabled} onChange={(e) => setEditing({ ...editing, quantity_enabled: e.target.checked })} />
                تفعيل الكمية (سعر متغير حسب الكمية)
              </label>
              {editing.quantity_enabled && (
                <>
                  <p className="text-xs text-muted-foreground">مثال: السعر 50 EG لكل 1000 كوينز. العميل يكتب الكمية اللي عاوزها والسعر يتحسب تلقائياً.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-muted-foreground">حجم الوحدة</label>
                      <input type="number" min={1} step="any" value={editing.unit_size} onChange={(e) => setEditing({ ...editing, unit_size: Number(e.target.value) })} className="w-full rounded-xl bg-secondary px-3 py-2" placeholder="1000" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">اسم الوحدة</label>
                      <input value={editing.unit_label} onChange={(e) => setEditing({ ...editing, unit_label: e.target.value })} className="w-full rounded-xl bg-secondary px-3 py-2" placeholder="كوينز" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">أقل كمية</label>
                      <input type="number" min={0} step="any" value={editing.min_quantity} onChange={(e) => setEditing({ ...editing, min_quantity: e.target.value })} className="w-full rounded-xl bg-secondary px-3 py-2" placeholder="1000" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">أعلى كمية</label>
                      <input type="number" min={0} step="any" value={editing.max_quantity} onChange={(e) => setEditing({ ...editing, max_quantity: e.target.value })} className="w-full rounded-xl bg-secondary px-3 py-2" placeholder="10000000" />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-xl border border-border bg-secondary/40 p-3 space-y-2">
              <label className="text-sm font-bold block">حقل البيانات المطلوبة من العميل / Customer field</label>
              <select
                value={editing.purchase_field_mode}
                onChange={(e) => setEditing({ ...editing, purchase_field_mode: e.target.value as "game_id" | "subscription" | "link" | "none" })}
                className="w-full rounded-xl bg-secondary px-3 py-2 text-sm"
              >
                <option value="game_id">ID اللاعب / الحساب (افتراضي) — Player / Account ID</option>
                <option value="subscription">اشتراك: بريد إلكتروني + كلمة مرور — Subscription (email + password)</option>
                <option value="link">رابط بروفايل / حساب — Profile / account link</option>
                <option value="none">بدون أي حقل — None</option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                اختر &quot;اشتراك&quot; لمنتجات زي Netflix و Spotify اللي بتحتاج إيميل بدل ID. اختر &quot;بدون&quot; لو مفيش أي بيانات لازمة.
              </p>
            </div>

            <div className="flex items-center gap-4 text-sm flex-wrap">
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> مفعّل</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing.in_stock} onChange={(e) => setEditing({ ...editing, in_stock: e.target.checked })} /> متوفر بالمخزون / In stock</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing.is_offer} onChange={(e) => setEditing({ ...editing, is_offer: e.target.checked })} /> عرض</label>
              <input type="number" placeholder="الترتيب" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="ml-auto w-20 rounded-xl bg-secondary px-3 py-2" />
            </div>
            {!editing.in_stock && (
              <div className="rounded-xl bg-destructive/15 border border-destructive text-destructive text-xs font-bold p-2 text-center">
                نفد المخزون — لن يستطيع العملاء شراء هذا المنتج / Out of stock — customers cannot purchase
              </div>
            )}

            {editing.id ? (
              <div className="rounded-xl border border-gold/40 bg-gold/5 p-3 space-y-2">
                <p className="text-sm font-extrabold text-gold-gradient">⚡ التنفيذ التلقائي / Auto-fulfillment</p>
                <p className="text-[11px] text-muted-foreground">يربط المنتج بمزود API. عند الشراء يتم تنفيذ الطلب تلقائياً. لو فشل أو انتظر +20 دقيقة، يتم استرداد الرصيد للعميل تلقائياً.</p>
                <div className="grid grid-cols-2 gap-2">
                  <select value={editing.provider} onChange={(e) => setEditing({ ...editing, provider: e.target.value as "" | "brand1" | "x3", provider_product_id: "" })} className="rounded-xl bg-secondary px-3 py-2 text-sm">
                    <option value="">بدون مزود</option>
                    <option value="brand1">Brand1 Card</option>
                    <option value="x3">X3 Store</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm font-bold rounded-xl bg-secondary px-3 py-2">
                    <input type="checkbox" checked={editing.auto_fulfill_enabled} onChange={(e) => setEditing({ ...editing, auto_fulfill_enabled: e.target.checked })} />
                    تفعيل
                  </label>
                </div>
                {editing.provider === "brand1" && (
                  <>
                    {brand1Products.isLoading && <p className="text-xs text-muted-foreground">جاري تحميل منتجات Brand1...</p>}
                    {brand1Products.data && !brand1Products.data.ok && (
                      <p className="text-xs text-destructive">تعذر جلب المنتجات: {brand1Products.data.error ?? "تأكد من السماح لكل الـ IPs في لوحة Brand1"}</p>
                    )}
                    {brand1Products.data?.ok && (
                      <select
                        value={editing.provider_product_id}
                        onChange={(e) => setEditing({ ...editing, provider_product_id: e.target.value })}
                        className="w-full rounded-xl bg-secondary px-3 py-2 text-sm"
                      >
                        <option value="">— اختر منتج Brand1 —</option>
                        {brand1Products.data.products.map((bp) => (
                          <option key={bp.id} value={bp.id}>
                            #{bp.id} • {bp.name} {bp.price ? `($${bp.price})` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      placeholder="أو اكتب الـ ID يدوياً"
                      dir="ltr"
                      value={editing.provider_product_id}
                      onChange={(e) => setEditing({ ...editing, provider_product_id: e.target.value })}
                      className="w-full rounded-xl bg-secondary px-3 py-2 text-sm"
                    />
                  </>
                )}
                {editing.provider === "x3" && (
                  <>
                    {x3Products.isLoading && <p className="text-xs text-muted-foreground">جاري تحميل منتجات X3...</p>}
                    {x3Products.data && !x3Products.data.ok && (
                      <p className="text-xs text-destructive">تعذر جلب المنتجات: {x3Products.data.error ?? "تأكد من التوكن والـ IPs في لوحة X3"}</p>
                    )}
                    {x3Products.data?.ok && (
                      <select
                        value={editing.provider_product_id}
                        onChange={(e) => setEditing({ ...editing, provider_product_id: e.target.value })}
                        className="w-full rounded-xl bg-secondary px-3 py-2 text-sm"
                      >
                        <option value="">— اختر منتج X3 —</option>
                        {x3Products.data.products.map((bp) => (
                          <option key={bp.id} value={bp.id}>
                            #{bp.id} • {bp.name} {bp.price ? `($${bp.price})` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      placeholder="أو اكتب الـ ID يدوياً"
                      dir="ltr"
                      value={editing.provider_product_id}
                      onChange={(e) => setEditing({ ...editing, provider_product_id: e.target.value })}
                      className="w-full rounded-xl bg-secondary px-3 py-2 text-sm"
                    />
                  </>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">احفظ المنتج أولاً ثم افتحه لإعداد التنفيذ التلقائي.</p>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-xl bg-secondary py-2 font-bold">إلغاء</button>
              <button disabled={save.isPending} className="flex-1 rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-2">حفظ</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function CollectionsTab() {
  const list = useServerFn(adminListCollections);
  const upsert = useServerFn(adminUpsertCollection);
  const del = useServerFn(adminDeleteCollection);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["admin-collections"], queryFn: () => list() });
  type EditState = { id?: string; slug: string; title: string; title_en: string; description_en: string; image_url: string; sort_order: number; is_active: boolean; show_on_home: boolean; parent_id: string | null };
  const [editing, setEditing] = useState<null | EditState>(null);
  const [manageId, setManageId] = useState<string | null>(null);

  const blank = (): EditState => ({ slug: "", title: "", title_en: "", description_en: "", image_url: "", sort_order: 0, is_active: true, show_on_home: true, parent_id: null });

  // Only top-level collections can be parents
  const parentOptions = data.filter((c) => !(c as { parent_id?: string | null }).parent_id);
  // Map for showing parent name on child cards
  const byId = new Map(data.map((c) => [c.id, c]));

  const save = useMutation({
    mutationFn: () => upsert({ data: { id: editing?.id, data: {
      slug: editing!.slug, title: editing!.title,
      title_en: editing!.title_en.trim() || null,
      description_en: editing!.description_en.trim() || null,
      image_url: editing!.image_url || null,
      sort_order: editing!.sort_order, is_active: editing!.is_active, show_on_home: editing!.show_on_home,
      parent_id: editing!.parent_id,
    } } }),
    onSuccess: () => { toast.success("تم / Saved"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-collections"] }); qc.invalidateQueries({ queryKey: ["collections-active"] }); qc.invalidateQueries({ queryKey: ["home-collections"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["admin-collections"] }); },
  });

  if (manageId) return <ProductsTab initialCollectionId={manageId} onBack={() => setManageId(null)} />;

  return (
    <div>
      <button onClick={() => setEditing(blank())} className="mb-4 rounded-full bg-gold-gradient text-primary-foreground font-bold px-4 py-2 text-sm flex items-center gap-2"><Plus className="size-4" /> قسم جديد</button>
      <p className="text-xs text-muted-foreground mb-3">القسم هو زر مثل "ببجي موبايل" — افتحه لإضافة منتجاته (UC، عروض...).</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.map((c) => {
          const cParentId = (c as { parent_id?: string | null }).parent_id ?? null;
          const parentRow = cParentId ? byId.get(cParentId) : null;
          return (
            <div key={c.id} className={`rounded-2xl bg-card/70 border p-4 ${cParentId ? "border-gold/30 ms-4" : "border-border"}`}>
              {c.image_url && <img src={c.image_url} alt={c.title} className="aspect-video w-full object-cover rounded-xl mb-2" />}
              <p className="font-extrabold">{cParentId && <span className="text-gold/70 me-1">↳</span>}{c.title}</p>
              <p className="text-xs text-muted-foreground">/{c.slug} • {c.is_active ? "مفعّل" : "متوقف"}{c.show_on_home && !cParentId ? " • في الرئيسية" : ""}</p>
              {parentRow && <p className="text-[11px] text-gold/80 mt-0.5">↑ {parentRow.title}</p>}
              <div className="mt-3 flex gap-2 flex-wrap">
                <button onClick={() => setManageId(c.id)} className="flex-1 rounded-lg bg-gold-gradient text-primary-foreground py-1.5 text-sm font-bold flex items-center justify-center gap-1"><Package className="size-4" /> المنتجات</button>
                <button onClick={() => setEditing({ id: c.id, slug: c.slug, title: c.title, title_en: (c as { title_en?: string | null }).title_en ?? "", description_en: (c as { description_en?: string | null }).description_en ?? "", image_url: c.image_url ?? "", sort_order: c.sort_order, is_active: c.is_active, show_on_home: c.show_on_home, parent_id: cParentId })} className="rounded-lg bg-secondary px-3 py-1.5 text-sm font-bold">تعديل / Edit</button>
                <button onClick={() => confirm("متأكد؟") && remove.mutate(c.id)} className="rounded-lg bg-destructive text-white px-3 py-1.5 text-sm font-bold"><Trash2 className="size-4" /></button>
              </div>
            </div>
          );
        })}
        {data.length === 0 && <p className="col-span-full text-center py-8 text-muted-foreground">لا يوجد أقسام. ابدأ بإضافة قسم زي "ببجي موبايل".</p>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="w-full max-w-lg bg-card border-gold rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-extrabold text-gold-gradient flex items-center gap-2"><Layers className="size-5" /> {editing.id ? "تعديل قسم" : "قسم جديد"}</h3>
            <input required placeholder="الاسم بالعربية (Arabic title)" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full rounded-xl bg-secondary px-3 py-2" />
            <input placeholder="English title (optional)" value={editing.title_en} onChange={(e) => setEditing({ ...editing, title_en: e.target.value })} dir="ltr" className="w-full rounded-xl bg-secondary px-3 py-2" />
            <input required placeholder="slug (مثال: pubg-mobile)" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} className="w-full rounded-xl bg-secondary px-3 py-2" dir="ltr" />
            <div>
              <label className="text-xs font-bold mb-1 block">القسم الأب / Parent category</label>
              <select value={editing.parent_id ?? ""} onChange={(e) => setEditing({ ...editing, parent_id: e.target.value || null })} className="w-full rounded-xl bg-secondary px-3 py-2">
                <option value="">— لا شيء (قسم رئيسي) / None (top-level)</option>
                {parentOptions.filter((p) => p.id !== editing.id).map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">لو اخترت أبًا، هذا القسم يصبح فرعيًا تحته (مسموح بمستويين فقط).</p>
            </div>
            <ImageUploadField value={editing.image_url} previewUrl={editing.image_url} onChange={(v) => setEditing({ ...editing, image_url: v })} label="صورة الزر" />
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> مفعّل</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!editing.show_on_home} onChange={(e) => setEditing({ ...editing, show_on_home: e.target.checked })} /> في الرئيسية / Show on home</label>
              <input type="number" placeholder="الترتيب" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="ml-auto w-20 rounded-xl bg-secondary px-3 py-2" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-xl bg-secondary py-2 font-bold">إلغاء</button>
              <button disabled={save.isPending} className="flex-1 rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-2">حفظ</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const getFn = useServerFn(getHomeSettings);
  const updateFn = useServerFn(adminUpdateHomeSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["home-settings-admin"], queryFn: () => getFn() });
  const [local, setLocal] = useState<{ show_featured: boolean; show_offers: boolean; show_collections: boolean } | null>(null);
  const state = local ?? data ?? { show_featured: true, show_offers: true, show_collections: true };
  const save = useMutation({
    mutationFn: () => updateFn({ data: state }),
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["home-settings"] }); qc.invalidateQueries({ queryKey: ["home-settings-admin"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = (k: keyof typeof state) => setLocal({ ...state, [k]: !state[k] });

  return (
    <div className="max-w-md">
      <div className="rounded-2xl bg-card/70 border border-border p-5 space-y-4">
        <h3 className="text-lg font-extrabold text-gold-gradient flex items-center gap-2"><SettingsIcon className="size-5" /> أقسام الصفحة الرئيسية</h3>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm">إظهار قسم "الأقسام"</span>
          <input type="checkbox" checked={state.show_collections} onChange={() => toggle("show_collections")} className="size-5" />
        </label>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm">إظهار قسم "الألعاب والتطبيقات"</span>
          <input type="checkbox" checked={state.show_featured} onChange={() => toggle("show_featured")} className="size-5" />
        </label>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm">إظهار قسم "أبرز العروض"</span>
          <input type="checkbox" checked={state.show_offers} onChange={() => toggle("show_offers")} className="size-5" />
        </label>
        <button disabled={save.isPending} onClick={() => save.mutate()} className="w-full rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-2 disabled:opacity-50">{save.isPending ? "..." : "حفظ"}</button>
      </div>
    </div>
  );
}



function BannersTab() {
  const list = useServerFn(adminListBanners);
  const upsert = useServerFn(adminUpsertBanner);
  const del = useServerFn(adminDeleteBanner);
  const upload = useServerFn(adminUploadBannerImage);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-banners"], queryFn: () => list() });
  const [editing, setEditing] = useState<null | { id?: string; image_url: string; link_url: string; title: string; title_en: string; is_active: boolean; sort_order: number }>(null);
  const [uploading, setUploading] = useState(false);

  const blank = () => ({ image_url: "", link_url: "", title: "", title_en: "", is_active: true, sort_order: 0 });

  const save = useMutation({
    mutationFn: () => upsert({ data: { id: editing?.id, data: {
      image_url: editing!.image_url,
      link_url: editing!.link_url || null,
      title: editing!.title || null,
      title_en: editing!.title_en.trim() || null,
      is_active: editing!.is_active,
      sort_order: editing!.sort_order,
    } } }),
    onSuccess: () => { toast.success("تم الحفظ / Saved"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-banners"] }); qc.invalidateQueries({ queryKey: ["banners-active"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (v: { id: string; storagePath?: string }) => del({ data: v }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["admin-banners"] }); qc.invalidateQueries({ queryKey: ["banners-active"] }); },
  });

  const handleFile = async (file: File) => {
    if (!editing) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("الصورة أكبر من 5MB"); return; }
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      let bin = ""; const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const base64 = btoa(bin);
      const { path } = await upload({ data: { filename: file.name, contentType: file.type || "image/jpeg", base64 } });
      setEditing({ ...editing, image_url: path });
      toast.success("تم رفع الصورة");
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(false); }
  };

  return (
    <div>
      <button onClick={() => setEditing(blank())} className="mb-4 rounded-full bg-gold-gradient text-primary-foreground font-bold px-4 py-2 text-sm flex items-center gap-2"><Plus className="size-4" /> إضافة بانر جديد</button>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(data ?? []).map((b) => (
          <div key={b.id} className="rounded-2xl bg-card/70 border border-border p-3">
            <img src={b.image_url} alt={b.title ?? ""} className="aspect-[16/6] w-full object-cover rounded-xl mb-2" />
            <p className="font-extrabold">{b.title || "—"}</p>
            <p className="text-xs text-muted-foreground truncate">{b.link_url || "بدون رابط"}</p>
            <p className="text-xs text-muted-foreground">ترتيب: {b.sort_order} • {b.is_active ? "مفعّل" : "متوقف"}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setEditing({ id: b.id, image_url: b.image_url.startsWith("http") ? "" : b.image_url, link_url: b.link_url ?? "", title: b.title ?? "", title_en: (b as { title_en?: string | null }).title_en ?? "", is_active: b.is_active, sort_order: b.sort_order })} className="flex-1 rounded-lg bg-secondary py-1.5 text-sm font-bold">تعديل / Edit</button>
              <button onClick={() => confirm("متأكد؟") && remove.mutate({ id: b.id })} className="rounded-lg bg-destructive text-white px-3 py-1.5 text-sm font-bold"><Trash2 className="size-4" /></button>
            </div>
          </div>
        ))}
        {(data ?? []).length === 0 && <p className="col-span-full text-center py-8 text-muted-foreground">لا يوجد بانرات. أضف أول واحد!</p>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (!editing.image_url) { toast.error("ارفع صورة أولاً"); return; } save.mutate(); }} className="w-full max-w-lg bg-card border-gold rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-extrabold text-gold-gradient flex items-center gap-2"><ImageIcon className="size-5" /> {editing.id ? "تعديل بانر" : "بانر جديد"}</h3>

            <label className="block">
              <div className="rounded-xl border-2 border-dashed border-gold/40 bg-secondary/50 p-4 text-center cursor-pointer hover:border-gold transition">
                <Upload className="mx-auto size-6 text-gold mb-1" />
                <p className="text-sm font-bold">{uploading ? "جاري الرفع..." : "اختر صورة (حتى 5MB)"}</p>
                <p className="text-xs text-muted-foreground mt-1">نسبة مفضلة 16:6</p>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </label>

            {editing.image_url && (
              <div className="rounded-xl overflow-hidden border border-border p-2">
                {editing.image_url.startsWith("http") ? (
                  <img src={editing.image_url} alt="" className="w-full aspect-[16/6] object-cover bg-black rounded-lg" />
                ) : (
                  <p className="text-xs text-emerald-400 font-bold">✓ تم رفع الصورة — اضغط حفظ للتفعيل</p>
                )}
              </div>
            )}

            
            <input placeholder="العنوان بالعربية (اختياري)" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full rounded-xl bg-secondary px-3 py-2" />
            <input placeholder="English title (optional)" value={editing.title_en} onChange={(e) => setEditing({ ...editing, title_en: e.target.value })} dir="ltr" className="w-full rounded-xl bg-secondary px-3 py-2" />
            <input placeholder="الرابط عند الضغط (اختياري)" value={editing.link_url} onChange={(e) => setEditing({ ...editing, link_url: e.target.value })} className="w-full rounded-xl bg-secondary px-3 py-2" />
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> مفعّل</label>
              <input type="number" placeholder="الترتيب" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="ml-auto w-24 rounded-xl bg-secondary px-3 py-2" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-xl bg-secondary py-2 font-bold">إلغاء</button>
              <button disabled={save.isPending || uploading} className="flex-1 rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-2 disabled:opacity-50">حفظ</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function AdminsTab({ isSuper }: { isSuper: boolean }) {
  const list = useServerFn(listAdmins);
  const grant = useServerFn(grantAdmin);
  const revoke = useServerFn(revokeAdmin);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admins"], queryFn: () => list() });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "super_admin">("admin");

  const add = useMutation({
    mutationFn: () => grant({ data: { email, role } }),
    onSuccess: () => { toast.success("تم"); setEmail(""); qc.invalidateQueries({ queryKey: ["admins"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rm = useMutation({
    mutationFn: (v: { userId: string; role: "admin" | "super_admin" }) => revoke({ data: v }),
    onSuccess: () => { toast.success("تم"); qc.invalidateQueries({ queryKey: ["admins"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      {isSuper && (
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="mb-5 rounded-2xl bg-card/70 border border-border p-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold block mb-1">إيميل الأدمن الجديد</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl bg-secondary px-3 py-2" />
          </div>
          <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "super_admin")} className="rounded-xl bg-secondary px-3 py-2">
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <button disabled={add.isPending} className="rounded-xl bg-gold-gradient text-primary-foreground font-extrabold px-4 py-2">إضافة</button>
        </form>
      )}
      <div className="space-y-2">
        {(data ?? []).map((a) => (
          <div key={`${a.user_id}-${a.role}`} className="rounded-2xl bg-card/70 border border-border p-4 flex items-center justify-between">
            <div>
              <p className="font-extrabold">{a.profile?.full_name || a.profile?.email || a.user_id.slice(0, 8)}</p>
              <p className="text-xs text-muted-foreground">{a.profile?.email} • {a.role === "super_admin" ? "Super Admin 👑" : "Admin"}</p>
            </div>
            {isSuper && <button onClick={() => confirm("متأكد؟") && rm.mutate({ userId: a.user_id, role: a.role as "admin" | "super_admin" })} className="rounded-lg bg-destructive text-white p-2"><Trash2 className="size-4" /></button>}
          </div>
        ))}
        {(data ?? []).length === 0 && <p className="text-center py-8 text-muted-foreground">لا يوجد أدمنز</p>}
      </div>
    </div>
  );
}

function PaymentMethodsTab() {
  const getFn = useServerFn(getPaymentMethods);
  const updateFn = useServerFn(adminUpdatePaymentMethods);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["payment-methods-admin"], queryFn: () => getFn() });
  type PMState = { vodafone_cash: string; instapay_account: string; instapay_link: string; binance: string; vodafone_cash_enabled: boolean; instapay_enabled: boolean; binance_enabled: boolean };
  const [local, setLocal] = useState<PMState | null>(null);
  const state: PMState = local ?? data ?? { vodafone_cash: "", instapay_account: "", instapay_link: "", binance: "", vodafone_cash_enabled: true, instapay_enabled: true, binance_enabled: true };
  const save = useMutation({
    mutationFn: () => updateFn({ data: state }),
    onSuccess: () => {
      toast.success("تم حفظ وسائل الدفع");
      qc.invalidateQueries({ queryKey: ["payment-methods"] });
      qc.invalidateQueries({ queryKey: ["payment-methods-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const set = <K extends keyof PMState>(k: K, v: PMState[K]) => setLocal({ ...state, [k]: v });

  const MaintenanceToggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
    <button
      type="button"
      onClick={onToggle}
      className={`text-[11px] font-extrabold rounded-full px-3 py-1 border ${enabled ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-400" : "bg-destructive/15 border-destructive/50 text-destructive"}`}
    >
      {enabled ? "✓ مفعّل" : "⚠ تحت الصيانة"}
    </button>
  );

  return (
    <div className="max-w-lg">
      <div className="rounded-2xl bg-card/70 border border-border p-5 space-y-4">
        <h3 className="text-lg font-extrabold text-gold-gradient flex items-center gap-2"><Wallet className="size-5" /> وسائل الدفع وأرقام الشحن</h3>
        <p className="text-xs text-muted-foreground">هذه البيانات تظهر للمستخدمين في صفحة شحن الرصيد. اضغط على الزر بجانب كل طريقة لإيقافها مؤقتًا للصيانة. (السوبر أدمن فقط)</p>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold">رقم فودافون كاش</label>
            <MaintenanceToggle enabled={state.vodafone_cash_enabled} onToggle={() => set("vodafone_cash_enabled", !state.vodafone_cash_enabled)} />
          </div>
          <input dir="ltr" value={state.vodafone_cash} onChange={(e) => set("vodafone_cash", e.target.value)} placeholder="01xxxxxxxxx" className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 text-right" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold">إنستا باي</label>
            <MaintenanceToggle enabled={state.instapay_enabled} onToggle={() => set("instapay_enabled", !state.instapay_enabled)} />
          </div>
          <input dir="ltr" value={state.instapay_account} onChange={(e) => set("instapay_account", e.target.value)} placeholder="name@instapay" className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 text-right mb-2" />
          <input dir="ltr" value={state.instapay_link} onChange={(e) => set("instapay_link", e.target.value)} placeholder="رابط إنستا باي (اختياري) https://ipn.eg/..." className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 text-right" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold">عنوان Binance / USDT (TRC20)</label>
            <MaintenanceToggle enabled={state.binance_enabled} onToggle={() => set("binance_enabled", !state.binance_enabled)} />
          </div>
          <input dir="ltr" value={state.binance} onChange={(e) => set("binance", e.target.value)} placeholder="Txxxxxxxxxxxxxxxxxxxxx" className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3 text-right" />
        </div>

        <button disabled={save.isPending} onClick={() => save.mutate()} className="w-full rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-2 disabled:opacity-50">
          {save.isPending ? "..." : "حفظ"}
        </button>
      </div>
    </div>
  );
}

function UsersTab() {
  const list = useServerFn(adminListUsers);
  const adjust = useServerFn(adminAdjustBalance);
  const setBanned = useServerFn(adminSetUserBanned);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<null | { id: string; name: string; balance: number }>(null);
  const [mode, setMode] = useState<"set" | "add" | "subtract">("set");
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState("");
  const [editCurrency, setEditCurrency] = useState<"EGP" | "USD">("EGP");
  const { rate } = useCurrency();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => list({ data: { search: search || undefined } }),
  });

  const computeEgpAmount = (): number | null => {
    const n = Number(amount);
    if (!isFinite(n) || isNaN(n)) return null;
    if (editCurrency === "EGP") return n;
    if (!rate || rate <= 0) return null;
    return Math.round(n * rate * 100) / 100;
  };

  const m = useMutation({
    mutationFn: () => {
      const egp = computeEgpAmount();
      if (egp === null) throw new Error("سعر الصرف غير متاح، حاول مرة أخرى");
      return adjust({ data: { userId: editing!.id, mode, amount: egp, note: note || undefined } });
    },
    onSuccess: () => {
      toast.success("تم تعديل الرصيد");
      setEditing(null); setAmount(""); setNote(""); setMode("set"); setEditCurrency("EGP");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const banMutation = useMutation({
    mutationFn: (vars: { userId: string; banned: boolean }) => setBanned({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(vars.banned ? "تم حظر المستخدم" : "تم إلغاء الحظر");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم / الإيميل / الرقم / رقم الحساب..."
          className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3"
        />
      </div>

      {isLoading && <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p>}

      <div className="space-y-3">
        {(data ?? []).length === 0 && !isLoading && <p className="text-center py-8 text-muted-foreground">لا يوجد مستخدمين</p>}
        {(data ?? []).map((u) => (
          <div key={u.id} className={`rounded-2xl bg-card/70 border p-4 flex flex-wrap items-center justify-between gap-3 ${u.is_banned ? "border-destructive/60" : "border-border"}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-extrabold truncate">{u.full_name || "—"}</p>
                {u.custom_id && <span dir="ltr" className="text-[10px] font-bold bg-gold/20 text-gold border border-gold/40 rounded-full px-2 py-0.5">#{u.custom_id}</span>}
                {u.is_banned && <span className="text-[10px] font-extrabold bg-destructive/20 text-destructive border border-destructive/50 rounded-full px-2 py-0.5">محظور</span>}
              </div>
              <p className="text-xs text-muted-foreground truncate">{u.email || "—"} {u.phone ? `• ${u.phone}` : ""}</p>
              <p className="mt-1 text-lg font-black text-gold-gradient">EG {Number(u.balance).toLocaleString()}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => { setEditing({ id: u.id, name: u.full_name || u.email || u.id, balance: Number(u.balance) }); setAmount(String(u.balance)); setMode("set"); setEditCurrency("EGP"); }}
                className="rounded-lg bg-gold-gradient text-primary-foreground font-bold px-4 py-2 text-sm flex items-center gap-1"
              >
                <Wallet className="size-4" /> تعديل الرصيد
              </button>
              <button
                disabled={banMutation.isPending}
                onClick={() => {
                  const confirmMsg = u.is_banned ? "إلغاء حظر هذا المستخدم؟" : "تأكيد حظر هذا المستخدم؟ لن يقدر يدخل ولا يشتري.";
                  if (confirm(confirmMsg)) banMutation.mutate({ userId: u.id, banned: !u.is_banned });
                }}
                className={`rounded-lg font-bold px-4 py-2 text-sm border ${u.is_banned ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/40" : "bg-destructive/20 text-destructive border-destructive/50"} disabled:opacity-50`}
              >
                {u.is_banned ? "إلغاء الحظر" : "حظر"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-card border-gold shadow-card p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-gold-gradient text-center">تعديل رصيد</h3>
            <p className="text-center text-sm text-muted-foreground mt-1">{editing.name}</p>
            <p className="text-center mt-2">
              الرصيد الحالي: <span className="font-extrabold text-gold">EG {editing.balance.toLocaleString()}</span>
              {rate && rate > 0 && (
                <span className="block text-xs text-muted-foreground mt-1">≈ USD {(editing.balance / rate).toFixed(2)}</span>
              )}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {([
                { id: "set", label: "تعيين" },
                { id: "add", label: "إضافة" },
                { id: "subtract", label: "خصم" },
              ] as const).map((o) => (
                <button key={o.id} onClick={() => {
                  setMode(o.id);
                  // Prefill current balance only for "set"; clear for add/subtract
                  if (o.id === "set" && editing) {
                    const v = editCurrency === "USD" && rate && rate > 0
                      ? (editing.balance / rate).toFixed(2)
                      : String(editing.balance);
                    setAmount(v);
                  } else {
                    setAmount("");
                  }
                }}
                  className={`rounded-xl py-2 text-sm font-bold ${mode === o.id ? "bg-gold-gradient text-primary-foreground" : "bg-secondary border border-border"}`}>
                  {o.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <label className="text-xs font-bold">العملة</label>
              <div className="inline-flex rounded-full bg-secondary border border-border p-1">
                {(["EGP", "USD"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      if (c === editCurrency) return;
                      const n = Number(amount);
                      if (amount && !isNaN(n) && rate && rate > 0) {
                        const converted = c === "USD" ? n / rate : n * rate;
                        setAmount((Math.round(converted * 100) / 100).toString());
                      }
                      setEditCurrency(c);
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${editCurrency === c ? "bg-gold-gradient text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs font-bold mb-1 block">المبلغ ({editCurrency})</label>
              <input type="number" step="any" {...(mode === "set" ? {} : { min: "0" })} value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3" />
              {editCurrency === "USD" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {rate && rate > 0 && amount && !isNaN(Number(amount))
                    ? `≈ EG ${(Number(amount) * rate).toLocaleString(undefined, { maximumFractionDigits: 2 })} (1 USD = ${rate.toFixed(2)} EGP)`
                    : !rate || rate <= 0
                      ? "جارٍ تحميل سعر الصرف..."
                      : `1 USD = ${rate.toFixed(2)} EGP`}
                </p>
              )}
            </div>

            <div className="mt-3">
              <label className="text-xs font-bold mb-1 block">ملاحظة (اختياري)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3" />
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-xl bg-secondary border border-border font-bold py-2.5">إلغاء</button>
              <button disabled={m.isPending || !amount || isNaN(Number(amount)) || (editCurrency === "USD" && (!rate || rate <= 0))} onClick={() => m.mutate()}
                className="flex-1 rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-2.5 disabled:opacity-50">
                {m.isPending ? "..." : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function DiscountsTab() {
  const list = useServerFn(adminListDiscounts);
  const upsert = useServerFn(adminUpsertDiscount);
  const del = useServerFn(adminDeleteDiscount);
  const listUsers = useServerFn(adminListUsers);
  const listProducts = useServerFn(adminListProducts);
  const qc = useQueryClient();

  const [userSearch, setUserSearch] = useState("");
  const [userId, setUserId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [percent, setPercent] = useState<string>("");

  const discounts = useQuery({ queryKey: ["admin-discounts"], queryFn: () => list({}) });
  const users = useQuery({
    queryKey: ["admin-users-pick", userSearch],
    queryFn: () => listUsers({ data: { search: userSearch || undefined } }),
  });
  const products = useQuery({ queryKey: ["admin-products-pick"], queryFn: () => listProducts() });

  const mAdd = useMutation({
    mutationFn: () => upsert({ data: { userId, productId, percent: Number(percent) } }),
    onSuccess: () => {
      toast.success("تم حفظ الخصم");
      setUserId(""); setProductId(""); setPercent(""); setUserSearch("");
      qc.invalidateQueries({ queryKey: ["admin-discounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["admin-discounts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = userId && productId && percent && Number(percent) > 0 && Number(percent) <= 100;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-card/70 border border-border p-4 space-y-3">
        <h3 className="font-extrabold text-gold-gradient">إضافة خصم لمستخدم</h3>

        <div>
          <label className="text-xs font-bold mb-1 block">ابحث عن المستخدم</label>
          <input
            value={userSearch}
            onChange={(e) => { setUserSearch(e.target.value); setUserId(""); }}
            placeholder="الاسم / الإيميل / الرقم"
            className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3"
          />
          {userSearch && (users.data ?? []).length > 0 && !userId && (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border">
              {(users.data ?? []).slice(0, 20).map((u) => (
                <button key={u.id} type="button"
                  onClick={() => { setUserId(u.id); setUserSearch(u.full_name || u.email || u.id); }}
                  className="w-full text-right px-3 py-2 hover:bg-secondary/60 block">
                  <p className="font-bold text-sm truncate">{u.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email || "—"} {u.phone ? `• ${u.phone}` : ""}</p>
                </button>
              ))}
            </div>
          )}
          {userId && <p className="text-xs text-gold mt-1">تم اختيار المستخدم ✓</p>}
        </div>

        <div>
          <label className="text-xs font-bold mb-1 block">المنتج</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3">
            <option value="">— اختر المنتج —</option>
            {(products.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.title} — EG {Number(p.price).toLocaleString()}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold mb-1 block">نسبة الخصم (%)</label>
          <input type="number" min="0.01" max="100" step="0.01" value={percent}
            onChange={(e) => setPercent(e.target.value)}
            placeholder="مثال: 2"
            className="w-full rounded-xl bg-secondary/60 border border-border px-4 py-3" />
        </div>

        <button disabled={!canSubmit || mAdd.isPending} onClick={() => mAdd.mutate()}
          className="w-full rounded-xl bg-gold-gradient text-primary-foreground font-extrabold py-2.5 disabled:opacity-50">
          {mAdd.isPending ? "..." : "حفظ الخصم"}
        </button>
        <p className="text-xs text-muted-foreground">ملاحظة: إذا كان للمستخدم خصم سابق على نفس المنتج، سيتم استبداله.</p>
      </div>

      <div>
        <h3 className="font-extrabold text-gold-gradient mb-2">الخصومات الحالية</h3>
        {discounts.isLoading && <p className="text-center py-6 text-muted-foreground">جاري التحميل...</p>}
        {!discounts.isLoading && (discounts.data ?? []).length === 0 && (
          <p className="text-center py-6 text-muted-foreground">لا توجد خصومات</p>
        )}
        <div className="space-y-2">
          {(discounts.data ?? []).map((d) => (
            <div key={d.id} className="rounded-2xl bg-card/70 border border-border p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-extrabold truncate text-sm">{d.profile?.full_name || d.profile?.email || d.user_id}</p>
                <p className="text-xs text-muted-foreground truncate">{d.product?.title || d.product_id}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="rounded-lg bg-gold-gradient text-primary-foreground font-black px-3 py-1 text-sm">{Number(d.percent)}%</span>
                <button onClick={() => mDel.mutate(d.id)} disabled={mDel.isPending}
                  className="rounded-lg bg-destructive/20 text-destructive border border-destructive/40 px-2 py-1.5">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================
// VIP Tab — manage tier table + manual assignment
// =============================================================
function VipTab() {
  const listFn = useServerFn(listVipTiers);
  const updateFn = useServerFn(adminUpdateVipTier);
  const assignFn = useServerFn(adminAssignVip);
  const revokeFn = useServerFn(adminRevokeVip);
  const qc = useQueryClient();
  const { data: tiers } = useQuery({ queryKey: ["vip-tiers"], queryFn: () => listFn() });
  const [edits, setEdits] = useState<Record<number, { name_ar?: string; name_en?: string; discount_percent?: number; spend_threshold?: number; usd_spend_threshold?: number; color_hex?: string; badge_url?: string }>>({});
  const [target, setTarget] = useState("");
  const [assignLvl, setAssignLvl] = useState<number>(1);
  const [revokeUid, setRevokeUid] = useState("");

  const mUpdate = useMutation({
    mutationFn: (v: { level: number } & Record<string, unknown>) => updateFn({ data: v as never }),
    onSuccess: (_d, v) => { toast.success(`تم حفظ المستوى ${v.level}`); setEdits((e) => { const c = { ...e }; delete c[v.level]; return c; }); qc.invalidateQueries({ queryKey: ["vip-tiers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mAssign = useMutation({
    mutationFn: (v: { customIdOrUserId: string; level: number }) => assignFn({ data: v }),
    onSuccess: () => { toast.success("تم منح المستوى"); setTarget(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mRevoke = useMutation({
    mutationFn: (val: string) => revokeFn({ data: { customIdOrUserId: val } }),
    onSuccess: () => { toast.success("تم السحب — رجع لوضع تلقائي"); setRevokeUid(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* Manual assign */}
      <div className="rounded-2xl bg-card/70 border border-border p-5 space-y-3">
        <h3 className="text-lg font-extrabold text-gold-gradient">منح VIP لمستخدم</h3>
        <p className="text-xs text-muted-foreground">أدخل الرقم التعريفي (custom_id) أو الإيميل أو رقم الهاتف أو الـ UUID. المنح اليدوي يلغي الترقية التلقائية لهذا المستخدم.</p>
        <div className="flex gap-2 flex-wrap items-end">
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="custom_id / email / phone" className="flex-1 min-w-[180px] rounded-xl bg-secondary px-3 py-2" />
          <select value={assignLvl} onChange={(e) => setAssignLvl(Number(e.target.value))} className="rounded-xl bg-secondary px-3 py-2">
            <option value={0}>0 — بدون</option>
            {Array.from({ length: 20 }).map((_, i) => <option key={i+1} value={i+1}>LV {i+1}</option>)}
          </select>
          <button disabled={mAssign.isPending || !target.trim()} onClick={() => mAssign.mutate({ customIdOrUserId: target.trim(), level: assignLvl })} className="rounded-xl bg-gold-gradient text-primary-foreground font-extrabold px-4 py-2 disabled:opacity-50">
            {mAssign.isPending ? "..." : "منح"}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap items-end pt-2 border-t border-border">
          <input value={revokeUid} onChange={(e) => setRevokeUid(e.target.value)} placeholder="custom_id / email / phone (UUID للمطور فقط)" className="flex-1 min-w-[180px] rounded-xl bg-secondary px-3 py-2" />
          <button disabled={mRevoke.isPending || !revokeUid.trim()} onClick={() => mRevoke.mutate(revokeUid.trim())} className="rounded-xl bg-destructive text-white font-bold px-4 py-2 disabled:opacity-50">سحب يدوي</button>
        </div>
      </div>

      {/* 20-level editable table */}
      <div>
        <h3 className="text-lg font-extrabold text-gold-gradient mb-2">المستويات (20)</h3>
        <p className="text-xs text-muted-foreground mb-3">عدّل الاسم بالعربية/الإنجليزية، نسبة الخصم %، وحد الإنفاق بالـ EGP والـ USD لكل مستوى (الاتنين منفصلين عشان تقدر تظبط القيمتين يدوي). اضغط حفظ بعد كل تغيير.</p>
        <div className="space-y-2">
          {(tiers ?? []).map((t) => {
            const e = edits[t.level] ?? {};
            const get = <K extends keyof typeof e>(k: K, def: unknown) => (e[k] !== undefined ? e[k] : def);
            const tierAny = t as typeof t & { usd_spend_threshold?: number | string; badge_url?: string | null };
            const currentBadge = (e.badge_url !== undefined ? e.badge_url : (tierAny.badge_url ?? "")) || "";
            const onPickImage = async (file: File) => {
              if (!file.type.startsWith("image/")) { toast.error("اختر صورة"); return; }
              if (file.size > 200 * 1024) { toast.error("الحد الأقصى 200KB"); return; }
              const dataUrl = await new Promise<string>((res, rej) => {
                const r = new FileReader();
                r.onload = () => res(String(r.result));
                r.onerror = () => rej(r.error);
                r.readAsDataURL(file);
              });
              setEdits({ ...edits, [t.level]: { ...e, badge_url: dataUrl } });
            };
            const L = ({ children }: { children: React.ReactNode }) => (
              <span className="block text-[10px] font-extrabold text-gold/70 mb-1 uppercase tracking-wide">{children}</span>
            );
            return (
              <div key={t.level} className="rounded-2xl bg-card/60 border border-border p-3 grid grid-cols-1 md:grid-cols-[auto_1fr_1fr_110px_130px_130px_auto] gap-2 md:items-end">
                <div className="flex flex-col items-center gap-2 min-w-[110px] md:pb-1">
                  <VipBadge level={t.level} color={t.color_hex} accent={t.accent_hex} badgeUrl={currentBadge || null} size={56} />
                  <span className="font-black text-gold text-sm">LV {t.level}</span>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] text-center rounded-md bg-secondary hover:bg-secondary/70 cursor-pointer px-2 py-1 font-bold">
                      {currentBadge ? "تغيير الصورة" : "رفع صورة"}
                      <input type="file" accept="image/*" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) void onPickImage(f); ev.target.value = ""; }} />
                    </label>
                    {currentBadge && (
                      <button type="button" onClick={() => setEdits({ ...edits, [t.level]: { ...e, badge_url: "" } })} className="text-[10px] rounded-md bg-destructive/20 hover:bg-destructive/30 text-destructive px-2 py-1 font-bold">إزالة</button>
                    )}
                  </div>
                </div>
                <div>
                  <L>الاسم بالعربي</L>
                  <input value={String(get("name_ar", t.name_ar) ?? "")} onChange={(ev) => setEdits({ ...edits, [t.level]: { ...e, name_ar: ev.target.value } })} placeholder="اسم عربي" className="w-full rounded-lg bg-secondary px-3 py-2 text-sm" />
                </div>
                <div>
                  <L>English Name</L>
                  <input value={String(get("name_en", t.name_en) ?? "")} onChange={(ev) => setEdits({ ...edits, [t.level]: { ...e, name_en: ev.target.value } })} placeholder="English name" dir="ltr" className="w-full rounded-lg bg-secondary px-3 py-2 text-sm" />
                </div>
                <div>
                  <L>الخصم %</L>
                  <input type="number" step="0.5" min="0" max="100" value={String(get("discount_percent", Number(t.discount_percent)))} onChange={(ev) => setEdits({ ...edits, [t.level]: { ...e, discount_percent: Number(ev.target.value) } })} placeholder="%" className="w-full rounded-lg bg-secondary px-3 py-2 text-sm" />
                </div>
                <div>
                  <L>السعر بالجنيه (EGP)</L>
                  <input type="number" min="0" value={String(get("spend_threshold", Number(t.spend_threshold)))} onChange={(ev) => setEdits({ ...edits, [t.level]: { ...e, spend_threshold: Number(ev.target.value) } })} placeholder="EGP" className="w-full rounded-lg bg-secondary px-3 py-2 text-sm" />
                </div>
                <div>
                  <L>Price in USD</L>
                  <input type="number" min="0" step="0.01" value={String(get("usd_spend_threshold", Number(tierAny.usd_spend_threshold ?? 0)))} onChange={(ev) => setEdits({ ...edits, [t.level]: { ...e, usd_spend_threshold: Number(ev.target.value) } })} placeholder="USD" dir="ltr" className="w-full rounded-lg bg-secondary px-3 py-2 text-sm" />
                </div>
                <button disabled={mUpdate.isPending || Object.keys(e).length === 0} onClick={() => mUpdate.mutate({ level: t.level, ...e })} className="rounded-lg bg-gold-gradient text-primary-foreground font-bold px-3 py-2 text-sm disabled:opacity-40 md:mb-0">حفظ</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
