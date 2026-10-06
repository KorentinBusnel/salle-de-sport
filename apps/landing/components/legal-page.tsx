import type { LegalPage } from "@/content/legal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/** Page simple (mentions légales, confidentialité) avec l'en-tête et le pied du site. */
export function LegalPageView({ page }: { page: LegalPage }) {
  return (
    <>
      <SiteHeader joinHref="/#inscription" />
      <main className="px-4 pt-10 pb-20 sm:px-6">
        <article className="mx-auto flex max-w-[720px] flex-col gap-8">
          <header className="flex flex-col gap-2">
            <h1 className="font-serif text-[clamp(36px,5vw,48px)] leading-[1.1] font-normal tracking-[-0.02em]">
              {page.title}
            </h1>
            <p className="text-sm text-muted-foreground">Mise à jour : {page.updated}</p>
          </header>
          {page.sections.map((section) => (
            <section key={section.title} className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
