import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Lion Store / شروط الاستخدام" },
      { name: "description", content: "Terms of use for the Lion Store platform." },
      { property: "og:url", content: "https://lions-stores.com/terms" },
    ],
    links: [{ rel: "canonical", href: "https://lions-stores.com/terms" }],
  }),
  component: Terms,
});

function Section({ h, p }: { h: string; p: string }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-foreground mb-2">{h}</h2>
      <p>{p}</p>
    </section>
  );
}

function Terms() {
  const { t } = useLang();
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-black text-gold-gradient mb-6">{t("شروط الاستخدام", "Terms of Use")}</h1>
        <div className="space-y-5 text-sm leading-7 text-muted-foreground">
          <Section h={t("١. قبول الشروط", "1. Acceptance of terms")} p={t("باستخدامك Lion Store فإنك توافق على هذه الشروط بشكل كامل. لو غير موافق، برجاء عدم استخدام المنصة.", "By using Lion Store you fully agree to these terms. If you don't agree, please don't use the platform.")} />
          <Section h={t("٢. الحسابات", "2. Accounts")} p={t("أنت مسؤول عن سرية بيانات حسابك وأي نشاط يتم من خلاله. ممنوع إنشاء حسابات وهمية أو استخدام بيانات مزورة.", "You're responsible for keeping your account credentials private and for any activity on your account. Fake accounts or forged data are not allowed.")} />
          <Section h={t("٣. الشحن والمشتريات", "3. Top-ups and purchases")} p={t("كل عمليات الشحن تتم يدويًا بعد التحقق. الرصيد لا يُسترد نقدًا ويُستخدم فقط لشراء المنتجات المتاحة على المتجر. أي محاولة احتيال هتؤدي لإيقاف الحساب وحجز الرصيد.", "All top-ups are processed manually after verification. Wallet balance is non-refundable in cash and can only be used to buy products on the store. Any fraud attempt will lead to suspension and balance freezing.")} />
          <Section h={t("٤. تسليم الطلبات", "4. Order delivery")} p={t("يتم تنفيذ الطلبات خلال دقائق إلى ساعات حسب نوع المنتج. لو فيه أي مشكلة في الطلب، تواصل معنا خلال ٢٤ ساعة.", "Orders are processed within minutes to hours depending on the product. If there's any issue, contact us within 24 hours.")} />
          <Section h={t("٥. الاسترجاع", "5. Refunds")} p={t("لا يمكن استرجاع الأكواد أو الشحنات بعد تنفيذها. في حالة عدم وصول المنتج، يتم رد الرصيد بعد التحقق.", "Delivered codes and top-ups can't be returned. If a product doesn't arrive, balance is refunded after verification.")} />
          <Section h={t("٦. تعديل الشروط", "6. Changes to these terms")} p={t("نحتفظ بحق تعديل هذه الشروط في أي وقت، وسيتم نشر التعديلات على نفس الصفحة.", "We may update these terms at any time. Updates will be posted on this page.")} />
          <p className="text-xs">{t("آخر تحديث: يونيو 2026", "Last updated: June 2026")}</p>
        </div>
      </div>
    </AppLayout>
  );
}
