import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage } from "@/components/CategoryPage";
import { games } from "@/lib/products";

export const Route = createFileRoute("/games")({
  head: () => ({ meta: [{ title: "شحن الألعاب — Lion Store" }, { name: "description", content: "شحن جميع الألعاب بأفضل الأسعار وبسهولة." }] }),
  component: () => <CategoryPage title="شحن الألعاب" subtitle="شحن الألعاب بكل سهولة وأمان" items={games} />,
});
