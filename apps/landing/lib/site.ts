import { z } from "zod";

/**
 * Adresse publique du site (canonical, sitemap, Open Graph, JSON-LD). `NEXT_PUBLIC_SITE_URL` si
 * elle est définie, sinon le domaine de production Vercel (variable système), sinon le poste local.
 */
export function siteUrl(): URL {
  const explicit = z.url().safeParse(process.env.NEXT_PUBLIC_SITE_URL || undefined);
  if (explicit.success) return new URL(explicit.data);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3001");
}

/** Déploiement de production : seul cas où les robots peuvent indexer le site. */
export function isProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}
