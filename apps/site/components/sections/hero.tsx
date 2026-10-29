import { CaretRightIcon, SparkleIcon, UsersThreeIcon } from "@phosphor-icons/react/ssr";
import { ButtonLink } from "@/components/button";
import { PhoneFrame, ProductFrame } from "@/components/frames";
import { CONTAINER } from "@/components/section-heading";
import { getGymCount } from "@/lib/gym-count";
import { t } from "@/lib/i18n";
import { FEATURES, GYM_COUNT_MIN, SECTIONS } from "@/lib/site";
import appPlanning from "@/public/captures/app-planning.jpg";
import today from "@/public/captures/aujourdhui.jpg";

export async function Hero() {
  // Compteur réel de salles, affiché seulement à partir d'un seuil (relu toutes les heures).
  const count = await getGymCount();

  return (
    <section id={SECTIONS.top} aria-labelledby="hero-title" className="overflow-hidden pt-24 pb-20">
      <div className={`${CONTAINER} pt-12 sm:pt-16`}>
        <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
          <a
            href={`#${FEATURES.assistant}`}
            className="inline-flex min-h-10 animate-rise items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium shadow-border transition-colors duration-300 ease-base hover:bg-background"
          >
            <SparkleIcon aria-hidden="true" weight="fill" className="size-4 text-primary" />
            {t("hero.announce")}
            <CaretRightIcon aria-hidden="true" className="size-4 text-muted-foreground" />
          </a>
          <h1
            id="hero-title"
            className="mt-8 animate-rise text-hero text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl"
          >
            {t("hero.title")}
          </h1>
          <p
            className="mt-6 max-w-hero animate-rise text-lg text-muted-foreground"
            style={{ animationDelay: "80ms" }}
          >
            {t("hero.subtitle")}
          </p>
          <div
            className="mt-8 flex w-full animate-rise flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
            style={{ animationDelay: "160ms" }}
          >
            <ButtonLink
              variant="outline"
              href={`#${SECTIONS.contact}`}
              className="w-full sm:w-auto"
            >
              {t("hero.contact")}
            </ButtonLink>
            <ButtonLink href={`#${SECTIONS.start}`} className="w-full sm:w-auto">
              {t("hero.start")}
            </ButtonLink>
          </div>
          <p
            className="mt-4 animate-rise text-sm text-muted-foreground"
            style={{ animationDelay: "160ms" }}
          >
            {t("hero.note")}
          </p>
          {count !== null && count >= GYM_COUNT_MIN ? (
            <p
              className="mt-6 flex animate-rise items-center gap-2 text-sm font-medium tabular-nums"
              style={{ animationDelay: "240ms" }}
            >
              <UsersThreeIcon aria-hidden="true" className="size-5 shrink-0 text-primary" />
              {t("hero.count", { count })}
            </p>
          ) : null}
        </div>

        <div
          className="relative mx-auto mt-16 max-w-5xl animate-rise pb-8 sm:pb-12"
          style={{ animationDelay: "320ms" }}
        >
          <ProductFrame
            src={today}
            alt={t("hero.backofficeAlt")}
            preload
            sizes="(min-width: 1024px) 1024px, 100vw"
          />
          <PhoneFrame
            src={appPlanning}
            alt={t("hero.appAlt")}
            className="absolute right-2 bottom-0 w-28 sm:right-6 sm:w-44 lg:-right-8 lg:w-56"
          />
        </div>
      </div>
    </section>
  );
}
