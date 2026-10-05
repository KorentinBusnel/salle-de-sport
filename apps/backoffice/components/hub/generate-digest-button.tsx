"use client";

import { RefreshCwIcon, SparklesIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { generateDigest } from "@/app/(app)/hub/actions";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/** Prépare (ou relit) la synthèse du jour : l'assistant lit la salle, ~30 s. */
export function GenerateDigestButton({
  again,
  variant = "default",
}: {
  again: boolean;
  variant?: "default" | "outline" | undefined;
}) {
  const [pending, startTransition] = useTransition();
  const Icon = again ? RefreshCwIcon : SparklesIcon;
  return (
    <Button
      variant={variant}
      disabled={pending}
      aria-busy={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await generateDigest();
          if (result.error) toast.error(t(result.error), { closeButton: true });
        })
      }
    >
      <Icon className={pending ? "animate-spin" : undefined} data-icon="inline-start" />
      {pending ? t("hub.generating") : t(again ? "hub.regenerate" : "hub.generate")}
    </Button>
  );
}
