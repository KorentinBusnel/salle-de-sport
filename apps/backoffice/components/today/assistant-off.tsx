import { SparklesIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/** Bloc Assistant de l'accueil quand la clé API manque (gérant) : une ligne et le chemin. */
export function AssistantOff() {
  return (
    <section
      aria-labelledby="assistant-inactif"
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-accent px-5 py-4"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <SparklesIcon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-[1_1_26rem]">
        <h2 id="assistant-inactif" className="text-base font-semibold">
          {t("today.assistantOff.title")}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("today.assistantOff.body")}</p>
      </div>
      <Button asChild variant="outline" className="bg-card">
        <Link href="/parametres?onglet=integrations">{t("today.assistantOff.cta")}</Link>
      </Button>
    </section>
  );
}
