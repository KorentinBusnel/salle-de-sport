import { legalPlaceholders } from "@/content/legal";
import { isProduction } from "@/lib/site";

/**
 * Refuse un build de production tant que les mentions légales ne sont pas complètes (obligation
 * légale) : appelée au rendu statique du layout, elle fait échouer `next build` sur Vercel.
 */
export function assertReadyForProduction(): void {
  if (!isProduction()) return;
  const missing = legalPlaceholders();
  if (missing.length > 0) {
    throw new Error(
      `Mise en ligne bloquée : informations légales à compléter dans content/legal.ts (${missing.join(", ")}).`,
    );
  }
}
