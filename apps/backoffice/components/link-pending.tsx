"use client";

import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

/**
 * Indice d'attente d'un lien (à placer dans un `Link`) : taille fixe, seule l'opacité change,
 * après un court délai pour ne rien afficher quand la page est déjà préchargée.
 */
export function LinkPending({ className }: { className?: string | undefined }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      data-pending={pending || undefined}
      className={cn(
        "pointer-events-none rounded-full bg-primary opacity-0 transition-opacity duration-150",
        "data-pending:opacity-100 data-pending:delay-150 motion-safe:data-pending:animate-pulse",
        className,
      )}
    />
  );
}
