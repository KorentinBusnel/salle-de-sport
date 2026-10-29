import { PlusIcon } from "@phosphor-icons/react/ssr";
import { Reveal } from "@/components/reveal";
import { CONTAINER, SectionHeading } from "@/components/section-heading";
import { t } from "@/lib/i18n";
import { SECTIONS } from "@/lib/site";

const QUESTIONS = [
  "app",
  "payments",
  "rejected",
  "offers",
  "coaches",
  "assistant",
  "roles",
  "data",
  "marketplace",
  "price",
] as const;

export function Faq() {
  const items = QUESTIONS.map((key) => ({
    key,
    question: t(`faq.${key}Q`),
    answer: t(`faq.${key}A`),
  }));
  // Questions et réponses en clair pour les moteurs et les assistants (skill A7).
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };

  return (
    <section id={SECTIONS.faq} aria-labelledby="questions-titre" className="py-20 sm:py-24">
      <div className={`${CONTAINER} grid gap-12 lg:grid-cols-3`}>
        <Reveal>
          <SectionHeading
            id="questions-titre"
            eyebrow={t("faq.eyebrow")}
            title={t("faq.title")}
            subtitle={t("faq.subtitle")}
          />
        </Reveal>
        <Reveal delay={80} className="space-y-3 lg:col-span-2">
          {items.map(({ key, question, answer }) => (
            <details key={key} className="group rounded-2xl bg-background">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl p-6 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {question}
                <PlusIcon
                  aria-hidden="true"
                  className="size-5 shrink-0 text-muted-foreground transition-transform duration-500 ease-base group-open:rotate-45"
                />
              </summary>
              <p className="px-6 pb-6 text-base text-muted-foreground">{answer}</p>
            </details>
          ))}
        </Reveal>
      </div>
      <script
        type="application/ld+json"
        // Contenu statique issu du catalogue : aucun texte saisi par un visiteur.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
      />
    </section>
  );
}
