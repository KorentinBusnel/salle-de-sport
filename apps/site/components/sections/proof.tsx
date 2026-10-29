import { Reveal } from "@/components/reveal";
import { CONTAINER, SectionHeading } from "@/components/section-heading";
import { frenchSpacing, t } from "@/lib/i18n";
import { TESTIMONIALS } from "@/lib/site";

// Faits vérifiables du produit seulement (aucun témoignage ni chiffre inventé).
const FACTS = [
  { value: "proof.planningValue", label: "proof.planningLabel" },
  { value: "proof.dunningValue", label: "proof.dunningLabel" },
  { value: "proof.rolesValue", label: "proof.rolesLabel" },
  { value: "proof.undoValue", label: "proof.undoLabel" },
  { value: "proof.overbookingValue", label: "proof.overbookingLabel" },
] as const;

export function Proof() {
  return (
    <section aria-labelledby="preuves-titre" className="bg-background py-20 sm:py-24">
      <div className={CONTAINER}>
        <Reveal className="max-w-3xl">
          <SectionHeading
            id="preuves-titre"
            eyebrow={t("proof.eyebrow")}
            title={t("proof.title")}
            subtitle={t("proof.body")}
          />
        </Reveal>
        <dl className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {FACTS.map(({ value, label }, index) => (
            <Reveal
              key={value}
              delay={index * 60}
              className="flex flex-col-reverse justify-end gap-2 rounded-2xl bg-card p-6 shadow-border"
            >
              <dt className="text-sm text-muted-foreground">{t(label)}</dt>
              <dd className="text-3xl font-semibold tracking-tight tabular-nums">{t(value)}</dd>
            </Reveal>
          ))}
        </dl>
        {TESTIMONIALS.map(({ quote, name, role }) => (
          <Reveal key={name} className="mt-12">
            <figure className="mx-auto max-w-hero text-center">
              <blockquote className="text-2xl font-medium tracking-tight">
                {frenchSpacing(`« ${quote} »`)}
              </blockquote>
              <figcaption className="mt-4 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{name}</span>, {role}
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
