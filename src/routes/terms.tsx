import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [
    { title: "شروط الاستخدام — Lion Store" },
    { name: "description", content: "شروط وأحكام استخدام منصة Lion Store." },
  ] }),
  component: Terms,
});

function Terms() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-black text-gold-gradient mb-6">شروط الاستخدام</h1>
        <div className="space-y-5 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">١. قبول الشروط</h2>
            <p>باستخدامك Lion Store فإنك توافق على هذه الشروط بشكل كامل. لو غير موافق، برجاء عدم استخدام المنصة.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">٢. الحسابات</h2>
            <p>أنت مسؤول عن سرية بيانات حسابك وأي نشاط يتم من خلاله. ممنوع إنشاء حسابات وهمية أو استخدام بيانات مزورة.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">٣. الشحن والمشتريات</h2>
            <p>كل عمليات الشحن تتم يدويًا بعد التحقق. الرصيد لا يُسترد نقدًا ويُستخدم فقط لشراء المنتجات المتاحة على المتجر. أي محاولة احتيال هتؤدي لإيقاف الحساب وحجز الرصيد.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">٤. تسليم الطلبات</h2>
            <p>يتم تنفيذ الطلبات خلال دقائق إلى ساعات حسب نوع المنتج. لو فيه أي مشكلة في الطلب، تواصل معنا خلال ٢٤ ساعة.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">٥. الاسترجاع</h2>
            <p>لا يمكن استرجاع الأكواد أو الشحنات بعد تنفيذها. في حالة عدم وصول المنتج، يتم رد الرصيد بعد التحقق.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">٦. تعديل الشروط</h2>
            <p>نحتفظ بحق تعديل هذه الشروط في أي وقت، وسيتم نشر التعديلات على نفس الصفحة.</p>
          </section>
          <p className="text-xs">آخر تحديث: يونيو 2026</p>
        </div>
      </div>
    </AppLayout>
  );
}
