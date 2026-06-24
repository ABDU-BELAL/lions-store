import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Lion Store / سياسة الخصوصية" },
      { name: "description", content: "How Lion Store collects, uses, and protects your personal data." },
      { property: "og:url", content: "https://lions-stores.com/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://lions-stores.com/privacy" }],
  }),
  component: Privacy,
});

function Section({ h, p }: { h: string; p: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-foreground mb-2">{h}</h2>
      <p>{p}</p>
    </section>
  );
}

function Privacy() {
  const { t } = useLang();
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-black text-gold-gradient mb-6">{t("سياسة الخصوصية", "Privacy Policy")}</h1>
        <div className="space-y-5 text-sm leading-7 text-muted-foreground">
          <Section
            h={t("١. البيانات التي نجمعها", "1. Data we collect")}
            p={t(
              "نجمع المعلومات الأساسية اللازمة لإنشاء حسابك (الاسم، الإيميل، رقم الهاتف)، بالإضافة إلى سجل المعاملات وطلبات الشحن لتقديم الخدمة.",
              "We collect basic information needed to create your account (name, email, phone), plus your transactions and top-up history to deliver the service.",
            )}
          />
          <Section
            h={t("٢. كيف نستخدم بياناتك", "2. How we use your data")}
            p={t(
              "نستخدم البيانات لتنفيذ الطلبات، مراجعة عمليات الشحن، التواصل معك بخصوص حسابك، وتحسين تجربتك على المنصة. لا نبيع بياناتك لأي طرف ثالث.",
              "We use your data to process orders, review top-ups, contact you about your account, and improve your experience. We never sell your data to third parties.",
            )}
          />
          <Section
            h={t("٣. التخزين والحماية", "3. Storage and security")}
            p={t(
              "يتم تخزين البيانات على خوادم آمنة مع تفعيل تشفير النقل (HTTPS) وسياسات وصول صارمة على قاعدة البيانات.",
              "Data is stored on secure servers with HTTPS encryption and strict row-level access policies on the database.",
            )}
          />
          <Section
            h={t("٤. ملفات تعريف الارتباط", "4. Cookies")}
            p={t("نستخدم ملفات الكوكيز لحفظ جلسة تسجيل الدخول فقط. لا نستخدم أي تتبع إعلاني.", "We only use cookies to keep you signed in. We don't use any advertising trackers.")}
          />
          <Section
            h={t("٥. حقوقك", "5. Your rights")}
            p={
              <>
                {t("تستطيع طلب تعديل أو حذف بياناتك في أي وقت عبر التواصل معنا على واتساب: ", "You can request editing or deletion of your data at any time via WhatsApp: ")}
                <span dir="ltr">01010594146</span>.
              </>
            }
          />
          <p className="text-xs">{t("آخر تحديث: يونيو 2026", "Last updated: June 2026")}</p>
        </div>
      </div>
    </AppLayout>
  );
}
