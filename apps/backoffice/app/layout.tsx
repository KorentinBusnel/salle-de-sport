import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { FlashToast } from "@/components/flash-toast";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import "./globals.css";

// Police de packages/ui (fontFamily.sans).
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: t("app.title"), template: `%s · ${t("app.title")}` },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={cn("font-sans", inter.variable)}>
      <body>
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster position="top-center" />
        <Suspense>
          <FlashToast />
        </Suspense>
      </body>
    </html>
  );
}
