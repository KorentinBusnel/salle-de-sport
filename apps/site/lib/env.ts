import { z } from "zod";

// Accès explicites : Next.js n'injecte que les NEXT_PUBLIC_* référencées littéralement.

const url = z.url();

/**
 * Adresse publique du site (métadonnées, image de partage, sitemap, llms.txt) : celle déclarée,
 * sinon le domaine de production fourni par Vercel (en production), sinon l'adresse du
 * déploiement (preview), sinon localhost. Lue côté serveur, au build.
 */
export function resolveSiteUrl(env: {
  declared?: string | undefined;
  vercelEnv?: string | undefined;
  productionHost?: string | undefined;
  deploymentHost?: string | undefined;
}): string {
  const declared = url.safeParse(env.declared?.trim());
  if (declared.success) return declared.data.replace(/\/+$/, "");
  if (env.vercelEnv === "production" && env.productionHost) return `https://${env.productionHost}`;
  if (env.deploymentHost) return `https://${env.deploymentHost}`;
  return "http://localhost:3001";
}

export const SITE_URL = resolveSiteUrl({
  declared: process.env.NEXT_PUBLIC_SITE_URL,
  vercelEnv: process.env.VERCEL_ENV,
  productionHost: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  deploymentHost: process.env.VERCEL_URL,
});

/** Indexation par les moteurs : déploiement de production Vercel seulement. */
export const INDEXABLE = process.env.VERCEL_ENV === "production";
