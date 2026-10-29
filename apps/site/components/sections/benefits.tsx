import {
  CalendarCheckIcon,
  CheckIcon,
  ClockIcon,
  CreditCardIcon,
  IdentificationCardIcon,
  SparkleIcon,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { StaticImageData } from "next/image";
import { AssistantIllustration } from "@/components/assistant-illustration";
import { FeatureScroller } from "@/components/feature-scroller";
import { ProductFrame } from "@/components/frames";
import { Reveal } from "@/components/reveal";
import { CONTAINER, SectionHeading } from "@/components/section-heading";
import { t } from "@/lib/i18n";
import { FEATURES, SECTIONS } from "@/lib/site";
import coaches from "@/public/captures/heures-coachs.jpg";
import member from "@/public/captures/fiche-adherent.jpg";
import payments from "@/public/captures/paiements.jpg";
import planning from "@/public/captures/planning.jpg";

type Benefit =
  | { key: "classes" | "payments" | "members" | "coaches"; icon: Icon; capture: StaticImageData }
  | { key: "assistant"; icon: Icon; capture?: undefined };

// L'IA en premier : c'est la promesse du hero.
const BENEFITS: Benefit[] = [
  { key: "assistant", icon: SparkleIcon },
  { key: "classes", icon: CalendarCheckIcon, capture: planning },
  { key: "payments", icon: CreditCardIcon, capture: payments },
  { key: "members", icon: IdentificationCardIcon, capture: member },
  { key: "coaches", icon: ClockIcon, capture: coaches },
];

export function Benefits() {
  return (
    <section
      id={SECTIONS.features}
      aria-labelledby="fonctionnalites-titre"
      className="bg-background py-20 sm:py-24"
    >
      <div className={CONTAINER}>
        <Reveal>
          <SectionHeading
            id="fonctionnalites-titre"
            centered
            eyebrow={t("benefits.eyebrow")}
            title={t("benefits.title")}
            subtitle={t("benefits.subtitle")}
          />
        </Reveal>
        <div className="mt-16 sm:mt-20">
          <FeatureScroller
            label={t("benefits.navLabel")}
            items={BENEFITS.map(({ key }) => ({
              id: FEATURES[key],
              label: t(`benefits.${key}.nav`),
            }))}
          >
            <div className="space-y-20 sm:space-y-24">
              {BENEFITS.map((benefit) => (
                <BenefitPanel key={benefit.key} benefit={benefit} />
              ))}
            </div>
          </FeatureScroller>
        </div>
      </div>
    </section>
  );
}

function BenefitPanel({ benefit }: { benefit: Benefit }) {
  const { key, icon: Icon } = benefit;
  const message = (part: "title" | "body" | "point1" | "point2" | "point3") =>
    t(`benefits.${key}.${part}`);

  return (
    <article id={FEATURES[key]} aria-labelledby={`${FEATURES[key]}-titre`}>
      <Reveal>
        <span className="flex size-10 items-center justify-center rounded-lg bg-card text-primary shadow-border">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <h3
          id={`${FEATURES[key]}-titre`}
          className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          {message("title")}
        </h3>
        <p className="mt-4 text-lg text-muted-foreground">{message("body")}</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {(["point1", "point2", "point3"] as const).map((point) => (
            <li key={point} className="flex gap-3 text-base">
              <CheckIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
              {message(point)}
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={80} className="mt-8">
        {benefit.capture ? (
          <ProductFrame
            src={benefit.capture}
            alt={t(`benefits.${benefit.key}.alt`)}
            sizes="(min-width: 1024px) 720px, 100vw"
          />
        ) : (
          <AssistantIllustration />
        )}
      </Reveal>
    </article>
  );
}
