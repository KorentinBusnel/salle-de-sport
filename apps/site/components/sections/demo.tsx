import { CheckCircleIcon } from "@phosphor-icons/react/ssr";
import { DemoForm } from "@/components/demo-form";
import { Reveal } from "@/components/reveal";
import { CONTAINER, SectionHeading } from "@/components/section-heading";
import { t } from "@/lib/i18n";
import { SECTIONS } from "@/lib/site";

// Réduction du risque (skill A4) : seulement ce qui est vrai aujourd'hui.
const REASSURANCE = ["demo.free", "demo.export", "demo.contactOnly"] as const;

export function Demo() {
  return (
    <section
      id={SECTIONS.demo}
      aria-labelledby="demo-titre"
      className="bg-background py-20 sm:py-24"
    >
      <div className={`${CONTAINER} grid gap-12 lg:grid-cols-2`}>
        <Reveal>
          <SectionHeading
            id="demo-titre"
            eyebrow={t("demo.eyebrow")}
            title={t("demo.title")}
            subtitle={t("demo.body")}
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
          <DemoForm />
        </Reveal>
      </div>
    </section>
  );
}
