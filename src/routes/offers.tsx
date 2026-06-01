import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage } from "@/components/CategoryPage";
import { offers } from "@/lib/products";

export const Route = createFileRoute("/offers")({
  head: () => ({ meta: [{ title: "العروض — Lion Store" }, { name: "description", content: "أحدث العروض والخصومات." }] }),
  component: () => <CategoryPage title="العروض" subtitle="عروض حصرية لفترة محدودة" items={offers} />,
});
