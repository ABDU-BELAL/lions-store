import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gold-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">الصفحة التي تبحث عنها غير متوفرة.</p>
        <a href="/" className="mt-6 inline-flex rounded-md bg-gold-gradient px-4 py-2 text-sm font-bold text-primary-foreground">العودة للرئيسية</a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold">حدث خطأ ما</h1>
        <p className="mt-2 text-sm text-muted-foreground">يرجى المحاولة مرة أخرى.</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 rounded-md bg-gold-gradient px-4 py-2 text-sm font-bold text-primary-foreground">إعادة المحاولة</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lion Store — شحن ألعاب وتطبيقات" },
      { name: "description", content: "ليون ستور — أسرع شحن ألعاب وتطبيقات بأفضل الأسعار وأمان كامل." },
      { property: "og:title", content: "Lion Store — شحن ألعاب وتطبيقات" },
      { property: "og:description", content: "ليون ستور — أسرع شحن ألعاب وتطبيقات بأفضل الأسعار وأمان كامل." },
      { name: "twitter:title", content: "Lion Store — شحن ألعاب وتطبيقات" },
      { name: "twitter:description", content: "ليون ستور — أسرع شحن ألعاب وتطبيقات بأفضل الأسعار وأمان كامل." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7a2c6755-acc8-4e39-8973-35fbb241a483/id-preview-64a8e514--21d93b29-8a13-49cd-a537-4926a576148c.lovable.app-1780829804391.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7a2c6755-acc8-4e39-8973-35fbb241a483/id-preview-64a8e514--21d93b29-8a13-49cd-a537-4926a576148c.lovable.app-1780829804391.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }, { rel: "preconnect", href: "https://fonts.googleapis.com" }, { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-center" richColors theme="dark" dir="rtl" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
