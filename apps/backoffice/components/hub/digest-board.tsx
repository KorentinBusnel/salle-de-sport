"use client";

import { type DailyDigest, DIGEST_CATEGORIES, type DigestItem } from "@salle/shared";
import { SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { dismissDigestItem } from "@/app/(app)/hub/actions";
import { openAssistant } from "@/components/command-palette";
import { SOURCE_ICON } from "@/components/hub/source-icon";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/**
 * Synthèse du jour en trois colonnes (Opérations, Clients, Finance) : une phrase par catégorie,
 * puis des cartes d'action. Le bouton ouvre l'assistant sur la demande préparée, qui aboutit à une
 * proposition à valider ; « Ignorer » écarte l'action pour la journée.
 */
export function DigestBoard({ digest }: { digest: DailyDigest }) {
  const [dismissed, dismiss] = useOptimistic(digest.dismissed, (current, id: string) => [
    ...current,
    id,
  ]);
  const [, startTransition] = useTransition();
  const hidden = new Set(dismissed);

  function ignore(item: DigestItem) {
    startTransition(async () => {
      dismiss(item.id);
      const result = await dismissDigestItem(item.id);
      if (result.error) toast.error(t(result.error), { closeButton: true });
    });
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      {DIGEST_CATEGORIES.map((key) => {
        const category = digest.categories.find((c) => c.key === key);
        const items = (category?.items ?? []).filter((item) => !hidden.has(item.id));
        return (
          <section
            key={key}
            aria-labelledby={`digest-${key}`}
            className="grid gap-3 rounded-2xl bg-muted/60 p-3"
          >
            <header className="flex items-center gap-2 px-1 pt-1">
              <h2 id={`digest-${key}`} className="font-semibold">
                {t(`hub.category.${key}`)}
              </h2>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-card px-1.5 text-xs font-semibold tabular-nums shadow-border">
                {items.length}
              </span>
            </header>
            {category ? (
              <p className="px-1 text-sm leading-relaxed font-medium">{category.summary}</p>
            ) : null}
            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                {t("hub.categoryEmpty")}
              </p>
            ) : (
              items.map((item) => <ActionCard key={item.id} item={item} onDismiss={ignore} />)
            )}
          </section>
        );
      })}
    </div>
  );
}

function ActionCard({
  item,
  onDismiss,
}: {
  item: DigestItem;
  onDismiss: (item: DigestItem) => void;
}) {
  const Icon = SOURCE_ICON[item.source];
  return (
    <article className="grid gap-2.5 rounded-xl bg-card p-3.5 shadow-border">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex size-6 items-center justify-center rounded-full bg-muted">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <span className="font-medium text-foreground/80">{t(`hub.source.${item.source}`)}</span>
        <span className="truncate">
          ·{" "}
          {item.memberId ? (
            <Link href={`/adherents/${item.memberId}`} className="hover:underline">
              {item.from}
            </Link>
          ) : (
            item.from
          )}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{item.read}</p>
      <p className="flex gap-2 text-sm font-semibold">
        <SparklesIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {item.action}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => openAssistant(item.prompt)}>
          {item.cta}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDismiss(item)}>
          {t("hub.dismiss")}
        </Button>
      </div>
    </article>
  );
}
