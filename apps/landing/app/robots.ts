import type { MetadataRoute } from "next";
import { robotsRules } from "@/lib/robots-rules";
import { isProduction, siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return robotsRules(siteUrl(), isProduction());
}
