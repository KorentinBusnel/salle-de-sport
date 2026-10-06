import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { HomeCard, HomeSection } from "@/components/today/home-section";
import { ShowMore } from "@/components/today/show-more";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import type { TeamContext } from "@/lib/auth";
import { gymFormatters, initials } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getCrmTodo } from "@/lib/nav-counts";
import { getTodayFrame, getTodayTrials } from "@/lib/today";
import { cn } from "@/lib/utils";

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

/** Clients : nouveaux venus du jour (accueil), CRM à compléter (gérant). */
export async function ClientsSection({ context }: { context: TeamContext }) {
  const frame = getTodayFrame(context);
  const [{ newcomers }, todo] = await Promise.all([
    getTodayTrials(context),
    frame.manager ? getCrmTodo(context.gym.id) : [],
  ]);
  const format = gymFormatters(frame.tz);
  return (
    <HomeSection
      id="clients"
      title={t("today.clients")}
      href={frame.manager ? "/crm" : "/adherents"}
      link={t(frame.manager ? "today.pipeline" : "nav.members")}
    >
      <div className={cn("grid items-start gap-4", frame.manager && "lg:grid-cols-2")}>
        <HomeCard title={t("today.newcomers")}>
          {newcomers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("today.newcomersEmpty")}</p>
          ) : (
            <ShowMore
              label={t("today.newcomers")}
              className="-mx-3 grid gap-0.5"
              items={newcomers.map((person) => {
                const name = `${person.first_name} ${person.last_name}`;
                return (
                  <li key={person.member_id}>
                    <Item asChild size="sm">
                      <Link href={`/adherents/${person.member_id}`}>
                        <ItemMedia>
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
                              {initials(name)}
                            </AvatarFallback>
                          </Avatar>
                        </ItemMedia>
                        <ItemContent className="min-w-0 gap-0">
                          <ItemTitle className="truncate">{name}</ItemTitle>
                          <ItemDescription className="truncate text-xs">
                            {person.discipline} {format.time(person.starts_at)}
                            {person.is_trial ? ` · ${t("today.trial")}` : ""}
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          <StatusPill tone="neutral" dot={false}>
                            {t("today.visit", { count: person.visit_number })}
                          </StatusPill>
                        </ItemActions>
                      </Link>
                    </Item>
                  </li>
                );
              })}
            />
          )}
        </HomeCard>
        {frame.manager ? (
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
        ) : null}
      </div>
    </HomeSection>
  );
}
