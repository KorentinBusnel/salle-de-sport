import Link from "next/link";
import { HomeCard, HomeSection } from "@/components/today/home-section";
import { Button } from "@/components/ui/button";
import type { TeamContext } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getCrmTodo } from "@/lib/nav-counts";

const CRM_LINKS = {
  incomplete: {
    label: "today.crm.incomplete",
    hint: "today.crm.incompleteHint",
    cta: "today.crm.complete",
  },
  unanswered: {
    label: "today.crm.unanswered",
    hint: "today.crm.unansweredHint",
    cta: "today.crm.answer",
  },
  trials_to_call: {
    label: "today.crm.trials",
    hint: "today.crm.trialsHint",
    cta: "today.crm.call",
  },
} as const;

/**
 * Clients (gérant) : CRM à compléter. Les nouveaux venus du jour sont dans Opérations (indicateur
 * et « Focus cours d'essai »), pas répétés ici.
 */
export async function ClientsSection({ context }: { context: TeamContext }) {
  const todo = await getCrmTodo(context.gym.id);
  return (
    <HomeSection id="clients" title={t("today.clients")} href="/crm" link={t("today.pipeline")}>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <HomeCard title={t("today.crm.title")}>
          <ul className="grid gap-1">
            {todo.map((row) => {
              const meta = CRM_LINKS[row.kind as keyof typeof CRM_LINKS];
              if (!meta) return null;
              return (
                <li key={row.kind} className="flex items-center gap-3 py-1.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted font-semibold tabular-nums">
                    {row.total}
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="font-medium">{t(meta.label)}</span>
                    <span className="truncate text-xs text-muted-foreground">{t(meta.hint)}</span>
                  </span>
                  {row.total > 0 ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/adherents?a_faire=${row.kind}`}>{t(meta.cta)}</Link>
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </HomeCard>
      </div>
    </HomeSection>
  );
}
