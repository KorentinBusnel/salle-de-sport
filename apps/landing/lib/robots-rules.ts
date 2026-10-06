import type { MetadataRoute } from "next";

/**
 * Robots nommés explicitement (LANDING_BRIEF.md §5.4, liste vérifiée sur la documentation de
 * chaque éditeur le 2026-10-06). Recherche et entraînement sont autorisés (BRIEF §12).
 */
export const SEARCH_BOTS = [
  "Googlebot",
  "Bingbot",
  "Applebot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
] as const;

export const TRAINING_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
] as const;

export function robotsRules(base: URL, production: boolean): MetadataRoute.Robots {
  // Hors production (previews, poste local) : rien n'est indexé.
  if (!production) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: [
      { userAgent: [...SEARCH_BOTS], allow: "/" },
      { userAgent: [...TRAINING_BOTS], allow: "/" },
      { userAgent: "*", allow: "/" },
    ],
    sitemap: new URL("/sitemap.xml", base).href,
  };
}
