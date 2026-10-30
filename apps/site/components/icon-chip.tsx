import type { Icon } from "@phosphor-icons/react";

/**
 * Pastille d'icône des cartes, des fonctionnalités et des étapes : même forme, même teinte et même
 * graisse partout (Phosphor au trait, 20 px dans 40 px). Décorative : le titre voisin porte le sens.
 */
export function IconChip({ icon: Icon }: { icon: Icon }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
      <Icon aria-hidden="true" className="size-5" />
    </span>
  );
}
