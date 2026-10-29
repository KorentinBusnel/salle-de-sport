import { CalendarCheckIcon, FadersIcon, UsersThreeIcon } from "@phosphor-icons/react/ssr";
import { Reveal } from "@/components/reveal";
import { CONTAINER, SectionHeading } from "@/components/section-heading";
import { t } from "@/lib/i18n";
import { SECTIONS } from "@/lib/site";

const STEPS = [
  { n: 1, icon: FadersIcon, title: "how.step1Title", body: "how.step1Body" },
  { n: 2, icon: UsersThreeIcon, title: "how.step2Title", body: "how.step2Body" },
  { n: 3, icon: CalendarCheckIcon, title: "how.step3Title", body: "how.step3Body" },
] as const;

export function HowItWorks() {
  return (
    <section
      id={SECTIONS.how}
      aria-labelledby="comment-titre"
      className="bg-background py-20 sm:py-24"
    >
      <div className={CONTAINER}>
        <Reveal>
          <SectionHeading
            id="comment-titre"
            centered
            eyebrow={t("how.eyebrow")}
            title={t("how.title")}
          />
        </Reveal>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map(({ n, icon: Icon, title, body }, index) => (
            <li key={n}>
              <Reveal
                delay={index * 80}
                className="h-full rounded-2xl bg-card p-6 shadow-border sm:p-8"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="text-sm font-semibold text-primary tabular-nums">
                    {t("how.step", { n })}
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-semibold tracking-tight">{t(title)}</h3>
                <p className="mt-2 text-base text-muted-foreground">{t(body)}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
