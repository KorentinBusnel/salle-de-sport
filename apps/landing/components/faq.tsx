import { faq } from "@/content/landing";

/** FAQ (§2.5) : questions visibles en H3, réponses dans le HTML (reprises dans le JSON-LD). */
export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="px-4 pb-20 sm:px-6">
      <div className="mx-auto max-w-[800px]">
        <h2
          id="faq-title"
          className="mb-6 font-serif text-[clamp(30px,3.4vw,40px)] leading-[1.1] font-normal tracking-[-0.02em]"
        >
          {faq.title}
        </h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {faq.items.map((item) => (
            <details key={item.question} className="group px-5 sm:px-6">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
                <h3 className="text-base font-semibold sm:text-[17px]">{item.question}</h3>
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-lg border border-border font-mono text-sm text-muted-foreground transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="pb-5 text-base leading-relaxed text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
