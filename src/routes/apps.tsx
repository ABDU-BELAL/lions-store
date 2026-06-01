import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage } from "@/components/CategoryPage";
import { apps } from "@/lib/products";

export const Route = createFileRoute("/apps")({
  head: () => ({ meta: [{ title: "شحن التطبيقات — Lion Store" }, { name: "description", content: "شحن التطبيقات والاشتراكات بسرعة وأمان." }] }),
  component: () => <CategoryPage title="شحن التطبيقات" subtitle="اشتراكات التطبيقات بأسرع توصيل" items={apps} />,
});
