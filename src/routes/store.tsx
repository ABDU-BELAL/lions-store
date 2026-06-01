import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage } from "@/components/CategoryPage";
import { games, apps, offers } from "@/lib/products";

export const Route = createFileRoute("/store")({
  head: () => ({ meta: [{ title: "المتجر — Lion Store" }] }),
  component: () => <CategoryPage title="المتجر" subtitle="جميع المنتجات في مكان واحد" items={[...games, ...apps, ...offers]} />,
});
