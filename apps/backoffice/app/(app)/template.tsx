import { ViewTransition, type ReactNode } from "react";

/**
 * Changement de section (barre latérale, liens marqués « nav ») : l'ancienne page s'efface, la
 * nouvelle apparaît. Rafraîchissement, action ou chargement de données : aucune animation.
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{ nav: "page-enter", default: "none" }}
      exit={{ nav: "page-exit", default: "none" }}
      default="none"
    >
      <div>{children}</div>
    </ViewTransition>
  );
}
