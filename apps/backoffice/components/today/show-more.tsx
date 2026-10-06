"use client";

import { ChevronDownIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Liste courte qui se déplie (« Voir les N autres ») plutôt qu'une zone à défilement : les
 * éléments sont rendus côté serveur, seul l'affichage est replié.
 */
export function ShowMore({
  items,
  initial = 5,
  label,
  className,
}: {
  /** Éléments `<li>` (avec leur `key`). */
  items: ReactNode[];
  initial?: number | undefined;
  /** Nom accessible de la liste. */
  label: string;
  className?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const hidden = items.length - initial;
  // Replier pour un seul élément ne fait rien gagner.
  const foldable = hidden > 1;
  return (
    <div className="grid gap-2">
      <ul id={listId} aria-label={label} className={className}>
        {foldable && !open ? items.slice(0, initial) : items}
      </ul>
      {foldable ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit text-muted-foreground"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronDownIcon
            data-icon="inline-start"
            aria-hidden
            className={cn("transition-transform duration-200", open && "rotate-180")}
          />
          {open ? t("ui.showLess") : t("ui.showMore", { count: hidden })}
        </Button>
      ) : null}
    </div>
  );
}
