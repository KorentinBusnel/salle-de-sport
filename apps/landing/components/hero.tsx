import Image from "next/image";
import { hero, pricing } from "@/content/landing";
import { WaitlistForm } from "@/components/waitlist-form";
import heroPhoto from "@/assets/hero-provisoire.webp";

/** Hero (§2.2) : photo en fond sous un voile sombre, titre, formulaire et tarif fondateur. */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="px-4 pt-2 pb-16 sm:px-6">
      <div className="relative isolate mx-auto max-w-[1392px] overflow-hidden rounded-2xl bg-foreground px-4 py-[72px] text-white sm:px-6 md:py-[120px]">
        <Image
          src={heroPhoto}
          alt={hero.photoAlt}
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(max-width: 1440px) 100vw, 1392px"
          className="-z-20 object-cover object-[center_35%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(rgb(12_10_9/0.55),rgb(12_10_9/0.72))]"
        />
        <div className="hero-in mx-auto flex max-w-[860px] flex-col items-center gap-6 text-center">
          <span className="inline-flex items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pr-3.5 pl-1.5 font-mono text-[11px] font-medium tracking-[0.04em] text-muted-foreground uppercase sm:text-xs">
            <span aria-hidden="true" className="ml-1.5 size-2 rounded-full bg-primary" />
            <span className="sm:hidden">{hero.badgeShort}</span>
            <span className="hidden sm:inline">{hero.badge}</span>
          </span>
          <h1
            id="hero-title"
            className="font-serif text-[clamp(44px,6.4vw,84px)] leading-[1.08] font-normal tracking-[-0.02em]"
          >
            {hero.title.before}
            <em className="italic">{hero.title.emphasis}</em>
            {hero.title.after}
          </h1>
          <p className="max-w-[600px] text-[17px] leading-[1.56] text-white/90 sm:text-lg">
            {hero.subtitle}
          </p>
          <div id="inscription" className="flex w-full justify-center">
            <WaitlistForm placement="hero" variant="onPhoto" />
          </div>
          <p className="inline-flex items-baseline gap-2.5 rounded-xl border border-border bg-card px-4 py-2.5 text-foreground">
            <span className="font-mono text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">
              {pricing.label}
            </span>
            <span className="text-xl font-semibold tabular-nums">{pricing.display}</span>
            <span className="text-sm text-muted-foreground">{pricing.period}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
