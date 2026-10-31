import { SITE_URL } from "@/lib/env";
import { llmsText } from "@/lib/llms";

// Fichier statique, régénéré à chaque build (adresse du site comprise).
export const dynamic = "force-static";

export function GET() {
  return new Response(llmsText(SITE_URL), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
