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
import { ProductFrame } from "@/components/frames";
import { IconChip } from "@/components/icon-chip";
import { Reveal } from "@/components/reveal";
import { CONTAINER, SectionHeading } from "@/components/section-heading";
import { cn } from "@/lib/cn";
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
        <div className="mt-16 space-y-20 sm:mt-20 sm:space-y-24">
          {BENEFITS.map((benefit, index) => (
            <BenefitRow key={benefit.key} benefit={benefit} flipped={index % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Une fonctionnalité : texte et capture côte à côte, en alternance d'une rangée à l'autre. */
function BenefitRow({ benefit, flipped }: { benefit: Benefit; flipped: boolean }) {
  const { key, icon: Icon } = benefit;
  const message = (part: "title" | "body" | "point1" | "point2" | "point3") =>
    t(`benefits.${key}.${part}`);

  return (
    <article
      id={FEATURES[key]}
      aria-labelledby={`${FEATURES[key]}-titre`}
      className="grid items-center gap-10 lg:grid-cols-5 lg:gap-16"
    >
      <Reveal className={cn("lg:col-span-2", flipped && "lg:order-last")}>
        <IconChip icon={Icon} />
        <h3
          id={`${FEATURES[key]}-titre`}
          className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          {message("title")}
        </h3>
        <p className="mt-4 text-lg text-muted-foreground">{message("body")}</p>
        <ul className="mt-6 space-y-3">
          {(["point1", "point2", "point3"] as const).map((point) => (
            <li key={point} className="flex gap-3 text-base">
              <CheckIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
              {message(point)}
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={80} className="lg:col-span-3">
        {benefit.capture ? (
          <ProductFrame src={benefit.capture} alt={t(`benefits.${benefit.key}.alt`)} />
        ) : (
          <AssistantIllustration />
        )}
      </Reveal>
    </article>
  );
}
