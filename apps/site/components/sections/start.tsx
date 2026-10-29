import { CheckCircleIcon } from "@phosphor-icons/react/ssr";
import { DemoForm } from "@/components/demo-form";
import { Reveal } from "@/components/reveal";
import { CONTAINER, SectionHeading } from "@/components/section-heading";
import { t } from "@/lib/i18n";
import { SECTIONS } from "@/lib/site";

// Réduction du risque (skill A4) : seulement ce qui est promis (essai gratuit, sans carte).
const REASSURANCE = ["start.free", "start.export", "start.contactOnly"] as const;

/** « Commencez gratuitement » et « Nous contacter » mènent ici (`#demarrer`, `#contact`). */
export function Start() {
  return (
    <section
      id={SECTIONS.start}
      aria-labelledby="demarrer-titre"
      className="bg-background py-20 sm:py-24"
    >
      <div className={`${CONTAINER} grid gap-12 lg:grid-cols-2`}>
        <Reveal>
          <SectionHeading
            id="demarrer-titre"
            eyebrow={t("start.eyebrow")}
            title={t("start.title")}
            subtitle={t("start.body")}
          />
          <ul className="mt-8 space-y-3">
            {REASSURANCE.map((key) => (
              <li key={key} className="flex gap-3 text-base font-medium">
                <CheckCircleIcon
                  aria-hidden="true"
                  weight="fill"
                  className="mt-0.5 size-5 shrink-0 text-primary"
                />
                {t(key)}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={80}>
          <div id={SECTIONS.contact} className="scroll-mt-24">
            <DemoForm />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
