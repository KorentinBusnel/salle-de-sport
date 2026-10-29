import { BarbellIcon } from "@phosphor-icons/react/ssr";
import { ButtonLink } from "@/components/button";
import { PhoneFrame, ProductFrame } from "@/components/frames";
import { CONTAINER } from "@/components/section-heading";
import { t } from "@/lib/i18n";
import { SECTIONS } from "@/lib/site";
import appPlanning from "@/public/captures/app-planning.jpg";
import today from "@/public/captures/aujourdhui.jpg";

export function Hero() {
  return (
    <section id={SECTIONS.top} aria-labelledby="hero-title" className="overflow-hidden pt-24 pb-20">
      <div className={`${CONTAINER} pt-12 sm:pt-16`}>
        <div className="mx-auto max-w-hero text-center">
          <p className="animate-rise text-sm font-semibold text-primary">{t("hero.eyebrow")}</p>
          <h1
            id="hero-title"
            className="mt-4 animate-rise text-hero text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
          >
            {t("hero.titleStart")} <br className="hidden sm:inline" />
            {t("hero.titleEnd")}
          </h1>
          <p
            className="mt-6 animate-rise text-lg text-muted-foreground"
            style={{ animationDelay: "80ms" }}
          >
            {t("hero.subtitle")}
          </p>
          <div
            className="mt-8 flex animate-rise flex-col items-center gap-3"
            style={{ animationDelay: "160ms" }}
          >
            <ButtonLink href={`#${SECTIONS.demo}`}>{t("hero.cta")}</ButtonLink>
            <p className="text-sm text-muted-foreground">{t("hero.ctaNote")}</p>
          </div>
          <p
            className="mx-auto mt-8 max-w-xs animate-rise text-sm font-medium sm:max-w-none"
            style={{ animationDelay: "240ms" }}
          >
            <BarbellIcon
              aria-hidden="true"
              className="mr-2 inline size-5 align-text-bottom text-primary"
            />
            {t("hero.proof")}
          </p>
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
