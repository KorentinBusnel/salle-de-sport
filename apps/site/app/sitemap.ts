import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";
import { LEGAL_COMPLETE } from "@/lib/site";

// Date du build : le site change à chaque déploiement.
const BUILT_AT = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: BUILT_AT, changeFrequency: "weekly", priority: 1 },
    // Pages légales listées une fois complètes (lib/site.ts, LEGAL_COMPLETE).
    ...(LEGAL_COMPLETE
      ? (["/confidentialite", "/mentions-legales"] as const).map((path) => ({
          url: `${SITE_URL}${path}`,
          lastModified: BUILT_AT,
          changeFrequency: "yearly" as const,
          priority: 0.2,
        }))
      : []),
  ];
}
