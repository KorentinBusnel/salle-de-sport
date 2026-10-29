import { CONTAINER } from "@/components/section-heading";
import { TaglineReveal } from "@/components/tagline-reveal";
import { t } from "@/lib/i18n";

/**
 * Phrase révélée mot à mot (skill B11), loin du hero, comme un temps à part. Une phrase par
 * ligne : en text-3xl sur mobile pour qu'aucune ne se coupe en laissant un mot seul.
 */
export function Tagline() {
  return (
    <section aria-label={t("tagline.line3")} className="bg-background py-20 sm:py-24">
      <div className={CONTAINER}>
        <TaglineReveal
          lines={[t("tagline.line1"), t("tagline.line2"), t("tagline.line3")]}
          className="mx-auto max-w-hero text-center text-3xl font-semibold tracking-tight sm:text-5xl"
        />
      </div>
    </section>
  );
}
