
## 1. إصلاح عرض الخصم في كل أماكن الشراء

السعر الأصلي **مشطوب** + السعر بعد الخصم بلون ذهبي + شارة "−X%".

الأماكن:
- `src/routes/collection.$slug.tsx` (نافذة الكميات — الصورة المرفقة)
- `src/routes/product.$id.tsx` (توحيد العرض)
- `src/routes/shop.tsx` + `src/components/ProductCard.tsx` (شارة −X% على الكارت)
- `src/routes/categories.tsx` / `search.tsx` (لو فيهم modal شراء)

hook موحّد `useEffectiveDiscount(productId)` يرجّع `MAX(user_manual_discount, vip_discount)` (الأعلى يكسب، لا يتجمعوا).

## 2. نظام VIP (20 مستوى منفصل)

### قاعدة البيانات (migration واحدة)

**جدول `vip_tiers`** — 20 صف ثابت، أعمدة قابلة للتعديل من الأدمن:
- `level` (1..20, PK)
- `name_ar`, `name_en` (نصوص قابلة للتعديل — تبدأ افتراضياً: مبتدئ، ناشئ، مستكشف، ... على نمط brand1، والأدمن يغيّرها)
- `discount_percent` (numeric 0–100)
- `spend_threshold` (numeric — إجمالي شراء بالـ EGP)
- `color_hex`, `accent_hex` (لون الشارة لكل مستوى — قابل للتعديل)
- `badge_url` (اختياري — لو الأدمن رفع صورة مخصصة)

**`profiles`** يضاف:
- `vip_level int default 0`
- `vip_assigned_by uuid null` (لو != null الأدمن خصصه يدوي → ثابت)
- `lifetime_spend numeric default 0`

**`vip_audit_log`** (تتبع كل تغيير VIP — للأمان):
- `actor_id`, `target_user_id`, `action` (assign/revoke/auto_promote), `old_level`, `new_level`, `created_at`

### الأمان (Defense Walls)

كل العمليات تمر عبر:
1. **RPC functions في DB بـ SECURITY DEFINER** — RLS لا تسمح للمستخدم بتعديل `vip_level` / `lifetime_spend` / `vip_assigned_by` على بروفايله مباشرة. UPDATE policy على `profiles` تمنع تعديل هذه الأعمدة (CHECK constraint via trigger).
2. **Trigger BEFORE UPDATE على `profiles`** يرفض أي تعديل من غير `service_role` على الأعمدة الثلاثة.
3. **`vip_tiers`**: SELECT لكل authenticated، UPDATE/INSERT/DELETE مرفوضة من Data API — التعديل فقط عبر RPC `admin_update_vip_tier` التي تتحقق `has_role(auth.uid(),'super_admin')`.
4. **Server functions** كلها `.middleware([requireSupabaseAuth])` + `assertSuperAdmin` re-check (TOCTOU)، + **Zod validation** صارم (level 1–20, percent 0–100, threshold ≥ 0)، + **rate limit** على endpoints الأدمن، + **audit log** insert في كل عملية.
5. **`process_purchase` و `process_order_after_insert`**: الخصم النهائي يُحسب server-side فقط من `MAX(user_discount, vip_discount)`. لا قيمة خصم تُرسل من الـ client.
6. **`lifetime_spend` و auto-promote**: عبر AFTER INSERT trigger على `orders` فقط — لا يمكن من Data API.
7. **بنود إضافية**: لو `vip_assigned_by IS NOT NULL` الـ trigger يتجاهل auto-promote (يدوي لا يُمس).
8. **Audit alerts**: كل assign/revoke يدوي يبعت إشعار Telegram للأدمن (شفافية).

### Server functions جديدة
`src/lib/vip.functions.ts`:
- `listVipTiers()` — public (authenticated)
- `getMyVip()` — يرجّع مستواه + lifetime_spend + المستوى التالي
- `adminUpdateVipTier({level, name_ar?, name_en?, discount_percent?, spend_threshold?, color_hex?, accent_hex?})` — super_admin فقط
- `adminAssignVip({userId, level})` — super_admin، يُسجّل في audit + يرسل notification + Telegram
- `adminRevokeVip({userId})` — super_admin، يعيد المستخدم لـ auto mode

### الواجهة

**Admin Dashboard** — تبويب جديد "VIP":
- جدول الـ20 مستوى inline-editable (الاسم AR/EN، النسبة، حد الإنفاق، اللون)
- زرّ "حفظ" لكل صف
- قسم منح/سحب VIP لمستخدم عبر custom_id

**Profile page**:
- شارة VIP الحالية بأنيميشن glow ذهبي + اسم المستوى
- شريط تقدم لـ "lifetime_spend / next_threshold"
- معرض الـ20 مستوى مع المقفول/المفتوح (نفس style brand1)

**Congrats notification**:
- لما `vip_level` يزيد → modal `VipCongratsModal` بـ confetti + الشارة الجديدة scale-in + رسالة "🎉 مبروك! ترقّيت لمستوى ..."
- يفتح تلقائياً عند أول login بعد الترقية (يقرأ من جدول notifications نوع `vip_promotion`)

### الشارات (20 شارة منفصلة)

كل شارة = SVG procedural component `<VipBadge level={n} />` يُولِّد شكل مميز لكل مستوى:
- **القاعدة**: درع/نجمة/شمس/ماسة (4 أشكال) × 5 طبقات لون متدرجة = 20 تركيبة فريدة
- **اللون**: مأخوذ من `vip_tiers.color_hex` (الأدمن يقدر يغيّر)
- **الرقم**: "LV {n}" بخط ذهبي عريض في المنتصف
- **الأنيميشن**: 
  - مقفول → grayscale + lock icon
  - مفتوح → glow pulse ذهبي + rotate-on-hover
  - الحالي للمستخدم → ring متوهج متحرك + sparkles
- **لا generation للصور** — كله SVG → سريع، خفيف، قابل للتعديل من الأدمن دون رفع ملفات.
- لو الأدمن رفع `badge_url` مخصص → يُعرض بدلاً من SVG.

## 3. الملفات

**جديد:**
- `supabase/migrations/*_vip_system.sql`
- `src/lib/vip.functions.ts`
- `src/components/VipBadge.tsx`
- `src/components/VipCongratsModal.tsx`
- `src/hooks/useEffectiveDiscount.ts`

**تعديل:**
- `src/lib/admin.functions.ts` — قسم VIP admin
- `src/lib/shop.functions.ts` — `getMyProductDiscount` يضم vip
- `src/routes/admin.tsx` — تبويب VIP
- `src/routes/profile.tsx` — شارة + معرض + progress
- `src/routes/collection.$slug.tsx` — عرض الخصم في modal الكميات
- `src/routes/product.$id.tsx` — توحيد
- `src/components/ProductCard.tsx` — شارة −X%
- `src/routes/__root.tsx` — VipCongratsModal mount global

## 4. تنفيذ مرحلي

1. Migration (جداول + triggers + RPCs + RLS)
2. Server functions + admin tab
3. UI الـ VIP (badge، profile، congrats)
4. إصلاح عرض الخصم في كل أماكن الشراء
