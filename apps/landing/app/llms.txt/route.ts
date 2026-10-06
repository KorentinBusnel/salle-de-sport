import { buildLlmsTxt } from "@/lib/llms";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-static";

/** /llms.txt : résumé du produit pour les assistants IA (lib/llms.ts). */
export function GET() {
  return new Response(buildLlmsTxt(siteUrl()), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
