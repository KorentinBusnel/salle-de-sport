import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

/**
 * Pastille d'icône du site : tuile neutre en relief (fond carte, ombre en couches du design
 * system), icône au trait dans la couleur du texte ; l'orange reste aux accents (points, boutons).
 * `md` : 40 px, icône de 20 px (cartes) ; `sm` : 32 px, icône de 16 px (listes). Décorative : le
 * texte voisin porte le sens.
 */
export function IconChip({ icon: Icon, size = "md" }: { icon: Icon; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-card text-foreground shadow-border",
        size === "md" ? "size-10" : "size-8",
      )}
    >
      <Icon aria-hidden="true" className={size === "md" ? "size-5" : "size-4"} />
    </span>
  );
}
