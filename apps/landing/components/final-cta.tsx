import { finalCta } from "@/content/landing";
import { WaitlistForm } from "@/components/waitlist-form";

/** Rappel final (§2.4) : tarif fondateur et même formulaire. */
export function FinalCta() {
  return (
    <section aria-labelledby="final-title" className="px-4 pb-20 sm:px-6">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-8 rounded-2xl border border-border bg-card p-6 sm:p-12">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3">
          <p className="font-mono text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            {finalCta.eyebrow}
          </p>
          <h2
            id="final-title"
            className="font-serif text-[clamp(34px,4vw,44px)] leading-[1.1] font-normal tracking-[-0.02em]"
          >
            {finalCta.title.before}
            <em className="italic">{finalCta.title.emphasis}</em>
            {finalCta.title.after}
          </h2>
          <p className="text-base leading-normal text-muted-foreground">
            <strong className="text-xl font-semibold text-foreground tabular-nums">
              {finalCta.price}
            </strong>
            {finalCta.text}
          </p>
        </div>
        <div className="flex min-w-0 flex-[1_1_380px]">
          <WaitlistForm placement="final" variant="onCard" />
        </div>
      </div>
    </section>
  );
}
