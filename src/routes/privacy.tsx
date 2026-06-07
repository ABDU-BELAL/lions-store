import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية — Lion Store" },
      { name: "description", content: "تعرّف على كيفية جمع ليون ستور لبياناتك وحمايتها، وحقوقك تجاه معلوماتك الشخصية." },
      { property: "og:title", content: "سياسة الخصوصية — Lion Store" },
      { property: "og:description", content: "كيف نحمي بياناتك في ليون ستور." },
      { property: "og:url", content: "https://lions-stores.com/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://lions-stores.com/privacy" }],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-black text-gold-gradient mb-6">سياسة الخصوصية</h1>
        <div className="space-y-5 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">١. البيانات التي نجمعها</h2>
            <p>نجمع المعلومات الأساسية اللازمة لإنشاء حسابك (الاسم، الإيميل، رقم الهاتف)، بالإضافة إلى سجل المعاملات وطلبات الشحن لتقديم الخدمة.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">٢. كيف نستخدم بياناتك</h2>
            <p>نستخدم البيانات لتنفيذ الطلبات، مراجعة عمليات الشحن، التواصل معك بخصوص حسابك، وتحسين تجربتك على المنصة. لا نبيع بياناتك لأي طرف ثالث.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">٣. التخزين والحماية</h2>
            <p>يتم تخزين البيانات على خوادم آمنة مع تفعيل تشفير النقل (HTTPS) وسياسات وصول صارمة (Row Level Security) على قاعدة البيانات.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">٤. ملفات تعريف الارتباط</h2>
            <p>نستخدم ملفات الكوكيز لحفظ جلسة تسجيل الدخول فقط. لا نستخدم أي تتبع إعلاني.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">٥. حقوقك</h2>
            <p>تستطيع طلب تعديل أو حذف بياناتك في أي وقت عبر التواصل معنا على واتساب: <span dir="ltr">01040483540</span>.</p>
          </section>
          <p className="text-xs">آخر تحديث: يونيو 2026</p>
        </div>
      </div>
    </AppLayout>
  );
}
