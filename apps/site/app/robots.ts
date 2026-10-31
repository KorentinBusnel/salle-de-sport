import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_URL } from "@/lib/env";

/**
 * Production : tout est ouvert, aux moteurs comme aux robots des assistants IA (GPTBot,
 * ClaudeBot, PerplexityBot, Google-Extended…), qui lisent aussi /llms.txt. Previews : rien.
 */
export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${SITE_URL}/sitemap.xml` };
}
