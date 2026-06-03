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
} from "@/lib/admin.functions";
import { adminListBanners, adminUpsertBanner, adminDeleteBanner, adminUploadBannerImage } from "@/lib/banners.functions";
import { useState } from "react";
import { toast } from "sonner";
import { Users, Wallet, ShoppingBag, Package, CheckCircle2, XCircle, Trash2, Plus, Crown, Shield, Image as ImageIcon, Upload } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "لوحة الأدمن — Lion Store" }] }),
  component: AdminPage,
});

type Tab = "stats" | "topups" | "products" | "banners" | "admins";

function AdminPage() {
  const { user, loading } = useAuth();
  const getAccount = useServerFn(getMyAccount);
  const account = useQuery({ queryKey: ["account"], queryFn: () => getAccount(), enabled: !!user });
  const [tab, setTab] = useState<Tab>("stats");

  if (!loading && !user) throw redirect({ to: "/login" });

  if (account.isLoading) return <AppLayout><p className="text-center py-12 text-muted-foreground">جاري التحميل...</p></AppLayout>;

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
          { id: "products", label: "المنتجات" },
          { id: "banners", label: "السلايدر" },
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
      {tab === "products" && <ProductsTab />}
      {tab === "banners" && <BannersTab />}
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

function ProductsTab() {
  const list = useServerFn(adminListProducts);
  const upsert = useServerFn(adminUpsertProduct);
  const del = useServerFn(adminDeleteProduct);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-products"], queryFn: () => list() });
  const [editing, setEditing] = useState<null | { id?: string; title: string; description: string; image_url: string; category: string; price: number; is_active: boolean; is_offer: boolean; sort_order: number }>(null);

  const blank = () => ({ title: "", description: "", image_url: "", category: "games", price: 0, is_active: true, is_offer: false, sort_order: 0 });

  const save = useMutation({
    mutationFn: () => upsert({ data: { id: editing?.id, data: {
      title: editing!.title, description: editing!.description || undefined, image_url: editing!.image_url || undefined,
      category: editing!.category, price: editing!.price, is_active: editing!.is_active, is_offer: editing!.is_offer, sort_order: editing!.sort_order,
    } } }),
    onSuccess: () => { toast.success("تم الحفظ"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-products"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["admin-products"] }); },
  });

  return (
    <div>
      <button onClick={() => setEditing(blank())} className="mb-4 rounded-full bg-gold-gradient text-primary-foreground font-bold px-4 py-2 text-sm flex items-center gap-2"><Plus className="size-4" /> إضافة منتج جديد</button>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(data ?? []).map((p) => (
          <div key={p.id} className="rounded-2xl bg-card/70 border border-border p-4">
            {p.image_url && <img src={p.image_url} alt={p.title} className="aspect-video w-full object-cover rounded-xl mb-2" />}
            <p className="font-extrabold">{p.title}</p>
            <p className="text-xs text-muted-foreground">{p.category} • {p.is_active ? "مفعّل" : "متوقف"}{p.is_offer ? " • عرض" : ""}</p>
            <p className="mt-1 font-black text-gold-gradient">EG {Number(p.price).toLocaleString()}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setEditing({ id: p.id, title: p.title, description: p.description ?? "", image_url: p.image_url ?? "", category: p.category, price: Number(p.price), is_active: p.is_active, is_offer: p.is_offer, sort_order: p.sort_order })} className="flex-1 rounded-lg bg-secondary py-1.5 text-sm font-bold">تعديل</button>
              <button onClick={() => confirm("متأكد؟") && remove.mutate(p.id)} className="rounded-lg bg-destructive text-white px-3 py-1.5 text-sm font-bold"><Trash2 className="size-4" /></button>
            </div>
          </div>
        ))}
        {(data ?? []).length === 0 && <p className="col-span-full text-center py-8 text-muted-foreground">لا يوجد منتجات. أضف أول واحد!</p>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="w-full max-w-lg bg-card border-gold rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-extrabold text-gold-gradient">{editing.id ? "تعديل منتج" : "منتج جديد"}</h3>
            <input required placeholder="الاسم" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full rounded-xl bg-secondary px-3 py-2" />
            <textarea placeholder="الوصف" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} className="w-full rounded-xl bg-secondary px-3 py-2" />
            <input placeholder="رابط الصورة" value={editing.image_url} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} className="w-full rounded-xl bg-secondary px-3 py-2" />
            <div className="grid grid-cols-2 gap-2">
              <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="rounded-xl bg-secondary px-3 py-2">
                <option value="games">ألعاب</option>
                <option value="apps">تطبيقات</option>
                <option value="packages">باقات</option>
                <option value="other">أخرى</option>
              </select>
              <input type="number" required min={0} placeholder="السعر" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className="rounded-xl bg-secondary px-3 py-2" />
            </div>
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> مفعّل</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing.is_offer} onChange={(e) => setEditing({ ...editing, is_offer: e.target.checked })} /> عرض</label>
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

function BannersTab() {
  const list = useServerFn(adminListBanners);
  const upsert = useServerFn(adminUpsertBanner);
  const del = useServerFn(adminDeleteBanner);
  const upload = useServerFn(adminUploadBannerImage);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-banners"], queryFn: () => list() });
  const [editing, setEditing] = useState<null | { id?: string; image_url: string; link_url: string; title: string; is_active: boolean; sort_order: number }>(null);
  const [uploading, setUploading] = useState(false);

  const blank = () => ({ image_url: "", link_url: "", title: "", is_active: true, sort_order: 0 });

  const save = useMutation({
    mutationFn: () => upsert({ data: { id: editing?.id, data: {
      image_url: editing!.image_url,
      link_url: editing!.link_url || null,
      title: editing!.title || null,
      is_active: editing!.is_active,
      sort_order: editing!.sort_order,
    } } }),
    onSuccess: () => { toast.success("تم الحفظ"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-banners"] }); qc.invalidateQueries({ queryKey: ["banners-active"] }); },
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
              <button onClick={() => setEditing({ id: b.id, image_url: b.image_url.startsWith("http") ? "" : b.image_url, link_url: b.link_url ?? "", title: b.title ?? "", is_active: b.is_active, sort_order: b.sort_order })} className="flex-1 rounded-lg bg-secondary py-1.5 text-sm font-bold">تعديل</button>
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

            <input placeholder="العنوان (اختياري)" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full rounded-xl bg-secondary px-3 py-2" />
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
