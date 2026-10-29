import { z } from "zod";

// Accès explicites : Next.js n'injecte que les NEXT_PUBLIC_* référencées littéralement.

/** Adresse publique du site (métadonnées, sitemap) ; localhost hors déploiement. */
export const SITE_URL = z
  .url()
  .catch("http://localhost:3001")
  .parse(process.env.NEXT_PUBLIC_SITE_URL);

/** Indexation par les moteurs : déploiement de production Vercel seulement. */
export const INDEXABLE = process.env.VERCEL_ENV === "production";
