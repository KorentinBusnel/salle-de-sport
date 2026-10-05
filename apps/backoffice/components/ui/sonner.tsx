"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";
import { t } from "@/lib/i18n";

// Thème clair uniquement (pas de mode sombre) : pas de next-themes. Succès et erreurs en
// style « soft » (Watermelon) sur les tokens de packages/ui.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      containerAriaLabel={t("ui.notifications")}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast font-sans shadow-border!",
          success:
            "bg-[color-mix(in_oklab,var(--color-success)_8%,var(--popover))]! text-success! border-success/25!",
          error:
            "bg-[color-mix(in_oklab,var(--destructive)_8%,var(--popover))]! text-destructive! border-destructive/25!",
          description: "text-foreground/80!",
          // Bouton « Annuler » (Watermelon sonner-6) : lisible, cible de 40 px au doigt.
          actionButton:
            "bg-card! text-foreground! shadow-border! font-medium! rounded-md! px-2.5! h-7! pointer-coarse:h-10! active:scale-[0.96]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
