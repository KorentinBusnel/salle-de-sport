import type { DailyDigest } from "@salle/shared";
import { SparklesIcon } from "lucide-react";
import Link from "next/link";
import { GenerateDigestButton } from "@/components/hub/generate-digest-button";
import { AssistantButton } from "@/components/today/assistant-button";
import { t } from "@/lib/i18n";

/** Brief du jour (gérant) : une ou deux phrases à l'impératif et au plus deux boutons. */
export function DailyBrief({ digest }: { digest: DailyDigest | null }) {
  return (
    <section
      aria-labelledby="brief-du-jour"
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-accent px-5 py-4"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <SparklesIcon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-[1_1_26rem]">
        <h2 id="brief-du-jour" className="text-xs font-semibold text-accent-foreground">
          {t("today.brief")}
        </h2>
        <p className="mt-0.5 text-base leading-snug font-medium text-balance">
          {digest ? digest.brief.text : t("today.briefEmpty")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {digest ? (
          <>
            {digest.brief.actions.map((action, index) => (
              <AssistantButton
                key={action.label}
                prompt={action.prompt}
                variant={index === 0 ? "default" : "outline"}
                className={index === 0 ? undefined : "bg-card"}
              >
                {action.label}
              </AssistantButton>
            ))}
            <Link
              href="/hub"
              className="px-1 text-sm font-medium text-accent-foreground hover:underline"
            >
              {t("today.openHub")}
            </Link>
          </>
        ) : (
          <GenerateDigestButton again={false} />
        )}
      </div>
    </section>
  );
}
