import { SparkleIcon } from "@phosphor-icons/react/ssr";
import { t } from "@/lib/i18n";

const MEMBERS = [
  ["assistantDemo.member1", "assistantDemo.member1Last"],
  ["assistantDemo.member2", "assistantDemo.member2Last"],
  ["assistantDemo.member3", "assistantDemo.member3Last"],
] as const;

/**
 * Échange type avec l'assistant, dessiné en code (une capture demanderait une clé Anthropic).
 * Noms fictifs, comme les données de démo.
 */
export function AssistantIllustration() {
  return (
    <figure className="rounded-2xl bg-neutral-100 p-2 shadow-border">
      <figcaption className="sr-only">{t("assistantDemo.caption")}</figcaption>
      <div className="space-y-4 rounded-lg bg-card p-4 sm:p-6">
        <p className="ml-auto w-fit max-w-xs rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
          {t("assistantDemo.question")}
        </p>
        <div className="flex gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
            <SparkleIcon aria-hidden="true" weight="fill" className="size-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-3 text-sm">
            <p>{t("assistantDemo.answer")}</p>
            <ul className="divide-y divide-border rounded-lg bg-background">
              {MEMBERS.map(([name, last]) => (
                <li key={name} className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-3 py-2">
                  <span className="font-medium">{t(name)}</span>
                  <span className="text-muted-foreground tabular-nums">{t(last)}</span>
                </li>
              ))}
            </ul>
            {/* Rayon 12 et marge 12 : la formule B3 donne 0, les boutons gardent leur rayon. */}
            <div className="rounded-xl bg-card p-3 shadow-border">
              <p className="text-xs font-semibold text-muted-foreground">
                {t("assistantDemo.proposal")}
              </p>
              <p className="mt-1 font-medium">{t("assistantDemo.proposalSubject")}</p>
              <div className="mt-3 flex justify-end gap-2" aria-hidden="true">
                <span className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold">
                  {t("assistantDemo.edit")}
                </span>
                <span className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                  {t("assistantDemo.validate")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
