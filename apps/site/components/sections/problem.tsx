import { CheckIcon, XIcon } from "@phosphor-icons/react/ssr";
import { Reveal } from "@/components/reveal";
import { CONTAINER } from "@/components/section-heading";
import { t, type MessageKey } from "@/lib/i18n";

const PAINS = [
  "problem.bookings",
  "problem.hours",
  "problem.unpaid",
  "problem.questions",
] as const satisfies readonly MessageKey[];

const FIXES = [
  "problem.solutionBookings",
  "problem.solutionTeam",
  "problem.solutionApp",
] as const satisfies readonly MessageKey[];

export function Problem() {
  return (
    <section aria-labelledby="probleme-titre" className="bg-background py-20 sm:py-24">
      <div className={`${CONTAINER} grid gap-6 md:grid-cols-2`}>
        <Reveal className="rounded-2xl bg-card p-6 shadow-border sm:p-8">
          <p className="text-sm font-semibold text-muted-foreground">{t("problem.beforeLabel")}</p>
          <h2
            id="probleme-titre"
            className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            {t("problem.title")}
          </h2>
          <ul className="mt-6 space-y-4">
            {PAINS.map((key) => (
              <li key={key} className="flex gap-3 text-base text-muted-foreground">
                <XIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
                {t(key)}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={80} className="rounded-2xl bg-accent p-6 sm:p-8">
          <p className="text-sm font-semibold text-accent-foreground">{t("problem.afterLabel")}</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("problem.solutionTitle")}
          </h3>
          <p className="mt-4 text-base text-foreground">{t("problem.solution")}</p>
          <ul className="mt-6 space-y-3">
            {FIXES.map((key) => (
              <li key={key} className="flex gap-3 text-base font-medium">
                <CheckIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                {t(key)}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
