import {
  CalculatorIcon,
  ChartLineUpIcon,
  CopyIcon,
  CreditCardIcon,
  FirstAidIcon,
  HandCoinsIcon,
  LockSimpleIcon,
  ShieldCheckIcon,
  SparkleIcon,
  SunHorizonIcon,
  TargetIcon,
  TimerIcon,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { StaticImageData } from "next/image";
import { AssistantIllustration } from "@/components/assistant-illustration";
import { ProductFrame } from "@/components/frames";
import { Orbits } from "@/components/orbits";
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

/** Pastille d'une carte : étape faite, réglage de la salle, ou action proposée. */
type CardTone = "success" | "brand" | "action";
type FeatureCard = { icon: Icon; tone: CardTone };
type Feature = {
  key: "classes" | "members" | "payments" | "coaches";
  capture: StaticImageData;
  cards: readonly [FeatureCard, FeatureCard];
};

// Sous l'assistant (la promesse du hero, en premier) : étiquette, titre court, une phrase, et
// deux cartes posées sur la capture pour montrer l'outil au travail.
const FEATURE_ROWS: Feature[] = [
  {
    key: "classes",
    capture: planning,
    cards: [
      { icon: CopyIcon, tone: "success" },
      { icon: TimerIcon, tone: "brand" },
    ],
  },
  {
    key: "members",
    capture: member,
    cards: [
      { icon: TargetIcon, tone: "brand" },
      { icon: FirstAidIcon, tone: "brand" },
    ],
  },
  {
    key: "payments",
    capture: payments,
    cards: [
      { icon: CreditCardIcon, tone: "success" },
      { icon: ChartLineUpIcon, tone: "brand" },
    ],
  },
  {
    key: "coaches",
    capture: coaches,
    cards: [
      { icon: CalculatorIcon, tone: "success" },
      { icon: HandCoinsIcon, tone: "action" },
    ],
  },
];

// Points de l'assistant : une icône par promesse (validation, brief du matin, notes protégées).
const ASSISTANT_POINTS = [
  { key: "point1", icon: ShieldCheckIcon },
  { key: "point2", icon: SunHorizonIcon },
  { key: "point3", icon: LockSimpleIcon },
] as const;

const TONE_CLASSES: Record<CardTone, string> = {
  success: "rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success",
  brand: "rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground",
  // Illustration d'un bouton du back office : pas un lien du site.
  action: "rounded-lg bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground",
};

export function Benefits() {
  return (
    <section
      id={SECTIONS.features}
      aria-labelledby="fonctionnalites-titre"
      className="relative isolate py-20 sm:py-24"
    >
      <Orbits />
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
          <AssistantRow />
          {FEATURE_ROWS.map((feature, index) => (
            <FeatureRow key={feature.key} feature={feature} flipped={index % 2 === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Point orange qui clôt chaque titre de fonctionnalité. */
function TitleDot() {
  return <span className="text-primary">.</span>;
}

/** L'assistant : pastille « Nouveauté », texte, trois points et l'échange animé. */
function AssistantRow() {
  return (
    <article
      id={FEATURES.assistant}
      aria-labelledby={`${FEATURES.assistant}-titre`}
      className="grid items-center gap-10 lg:grid-cols-5 lg:gap-16"
    >
      <Reveal className="lg:col-span-2">
        <p className="inline-flex items-center gap-2 rounded-full bg-accent py-1 pr-3 pl-1 text-sm font-medium text-accent-foreground">
          <span className="flex size-6 items-center justify-center rounded-full bg-card text-primary shadow-border">
            <SparkleIcon aria-hidden="true" className="size-4" />
          </span>
          {t("benefits.assistant.badge")}
        </p>
        <h3
          id={`${FEATURES.assistant}-titre`}
          className="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
        >
          {t("benefits.assistant.title")}
          <TitleDot />
        </h3>
        <p className="mt-4 text-lg text-muted-foreground">{t("benefits.assistant.body")}</p>
        <ul className="mt-6 space-y-3">
          {ASSISTANT_POINTS.map(({ key, icon }) => (
            <li key={key} className="flex items-start gap-3 text-base">
              <IconChip icon={icon} size="sm" />
              <span className="pt-1">{t(`benefits.assistant.${key}`)}</span>
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={80} className="lg:col-span-3">
        <AssistantIllustration />
      </Reveal>
    </article>
  );
}

/**
 * Une fonctionnalité : étiquette, titre et phrase à côté de la capture, en alternance. Les deux
 * cartes débordent de la capture côté texte (dès `lg`), et se posent dessous sur petit écran.
 */
function FeatureRow({ feature, flipped }: { feature: Feature; flipped: boolean }) {
  const { key, capture, cards } = feature;
  const id = FEATURES[key];

  return (
    <article
      id={id}
      aria-labelledby={`${id}-titre`}
      className="grid items-center gap-10 lg:grid-cols-5 lg:gap-16"
    >
      <Reveal className={cn("lg:col-span-2", flipped && "lg:order-last")}>
        <p className="flex items-center gap-2 text-sm font-medium">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          {t(`benefits.${key}.label`)}
        </p>
        <h3
          id={`${id}-titre`}
          className="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
        >
          {t(`benefits.${key}.title`)}
          <TitleDot />
        </h3>
        <p className="mt-4 text-lg text-pretty text-muted-foreground">
          {t(`benefits.${key}.body`)}
        </p>
      </Reveal>
      <Reveal delay={80} className="relative lg:col-span-3">
        <ProductFrame src={capture} alt={t(`benefits.${key}.alt`)} />
        <ul
          className={cn(
            "mt-4 grid gap-2 sm:max-w-md lg:absolute lg:-bottom-8 lg:mt-0 lg:w-112",
            flipped ? "lg:-right-8" : "lg:-left-8",
          )}
        >
          {cards.map((card, index) => {
            const n = index === 0 ? "card1" : "card2";
            return (
              <li key={n}>
                <Reveal
                  delay={240 + index * 120}
                  className="flex items-center gap-3 rounded-2xl bg-card p-2 pr-3 shadow-border-hover"
                >
                  <IconChip icon={card.icon} />
                  <span className="grid min-w-0 flex-1">
                    <span className="text-sm font-semibold">{t(`benefits.${key}.${n}`)}</span>
                    <span className="text-sm text-muted-foreground">
                      {t(`benefits.${key}.${n}Detail`)}
                    </span>
                  </span>
                  <span className={cn("shrink-0 tabular-nums", TONE_CLASSES[card.tone])}>
                    {t(`benefits.${key}.${n}Status`)}
                  </span>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </article>
  );
}
