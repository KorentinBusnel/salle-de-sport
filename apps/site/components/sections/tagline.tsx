import { CONTAINER } from "@/components/section-heading";
import { TaglineReveal } from "@/components/tagline-reveal";
import { t } from "@/lib/i18n";

/** Phrase révélée mot à mot (skill B11), loin du hero, comme un temps à part. */
export function Tagline() {
  return (
    <section aria-label={t("tagline.line3")} className="bg-background py-20 sm:py-24">
      <div className={CONTAINER}>
        <TaglineReveal
          lines={[t("tagline.line1"), t("tagline.line2"), t("tagline.line3")]}
          className="mx-auto max-w-hero text-center text-4xl font-semibold tracking-tight text-balance sm:text-5xl"
        />
      </div>
    </section>
  );
}
