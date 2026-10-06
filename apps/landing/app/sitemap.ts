import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: new URL("/", base).href, changeFrequency: "weekly", priority: 1 },
    { url: new URL("/mentions-legales", base).href, changeFrequency: "yearly", priority: 0.2 },
    { url: new URL("/confidentialite", base).href, changeFrequency: "yearly", priority: 0.2 },
  ];
}
