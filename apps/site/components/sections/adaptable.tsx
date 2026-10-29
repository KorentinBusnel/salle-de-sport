import {
  BarbellIcon,
  CalendarBlankIcon,
  EnvelopeSimpleIcon,
  FadersIcon,
  TagIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/ssr";
import { Reveal } from "@/components/reveal";
import { CONTAINER, SectionHeading } from "@/components/section-heading";
import { t } from "@/lib/i18n";
import { SECTIONS } from "@/lib/site";

// Ce que la salle règle elle-même : uniquement des paramètres qui existent dans le produit.
const CARDS = [
  { key: "activities", icon: BarbellIcon },
  { key: "offers", icon: TagIcon },
  { key: "rules", icon: FadersIcon },
  { key: "team", icon: UsersThreeIcon },
  { key: "hours", icon: CalendarBlankIcon },
  { key: "messages", icon: EnvelopeSimpleIcon },
] as const;

/** « Pour toutes les salles » : un outil flexible, adaptable à toute salle et toute activité. */
export function Adaptable() {
  return (
    <section
      id={SECTIONS.adaptable}
      aria-labelledby="toutes-les-salles-titre"
      className="py-20 sm:py-24"
    >
      <div className={CONTAINER}>
        <Reveal>
          <SectionHeading
            id="toutes-les-salles-titre"
            centered
            eyebrow={t("adaptable.eyebrow")}
            title={t("adaptable.title")}
            subtitle={t("adaptable.subtitle")}
          />
        </Reveal>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map(({ key, icon: Icon }, index) => (
            <li key={key}>
              <Reveal delay={index * 60} className="h-full rounded-2xl bg-background p-6">
                <span className="flex size-10 items-center justify-center rounded-lg bg-card text-primary shadow-border">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <h3 className="mt-6 text-lg font-semibold tracking-tight">
                  {t(`adaptable.${key}Title`)}
                </h3>
                <p className="mt-2 text-base text-muted-foreground">{t(`adaptable.${key}Body`)}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
