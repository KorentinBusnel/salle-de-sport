import { ChevronRightIcon, CircleCheckIcon, CircleIcon } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import type { TeamContext } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getSetupSteps } from "@/lib/today";

/** Mise en route de la salle (gérant) : étapes restantes, masquée une fois tout fait. */
export async function SetupChecklist({ context }: { context: TeamContext }) {
  const steps = await getSetupSteps(context);
  const done = steps.filter((step) => step.done).length;
  if (done === steps.length) return null;
  const progress = Math.round((done / steps.length) * 100);
  // Étapes restantes d'abord (tri stable : l'ordre de lecture est gardé).
  const ordered = [...steps].sort((a, b) => Number(a.done) - Number(b.done));
  return (
    <Card aria-labelledby="mise-en-route">
      <CardHeader>
        <CardTitle id="mise-en-route" className="font-semibold">
          {t("today.setup.title")}
        </CardTitle>
        <CardDescription>{t("today.setup.hint")}</CardDescription>
        <CardAction className="text-sm font-medium text-muted-foreground tabular-nums">
          {t("today.setup.progress", { done, total: steps.length })}
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Progress value={progress} aria-label={t("today.setup.title")} />
        <ul className="-mx-2.5 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((step) =>
            step.done ? (
              <li key={step.key}>
                <Item size="xs" className="text-muted-foreground">
                  <ItemMedia variant="icon">
                    <CircleCheckIcon aria-hidden className="text-success" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="font-normal text-muted-foreground line-through">
                      {t(`today.setup.steps.${step.key}`)}
                      <span className="sr-only"> — {t("today.setup.done")}</span>
                    </ItemTitle>
                  </ItemContent>
                </Item>
              </li>
            ) : (
              <li key={step.key}>
                <Item asChild size="xs">
                  <Link href={step.href}>
                    <ItemMedia variant="icon">
                      <CircleIcon aria-hidden className="text-muted-foreground" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{t(`today.setup.steps.${step.key}`)}</ItemTitle>
                    </ItemContent>
                    <ItemActions>
                      <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground" />
                    </ItemActions>
                  </Link>
                </Item>
              </li>
            ),
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
