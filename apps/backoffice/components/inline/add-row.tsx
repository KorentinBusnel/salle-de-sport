"use client";

import { PlusIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { type MessageKey, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Ligne « + Nouveau » d'un tableau éditable : crée avec les valeurs par défaut. */
export function AddRow({
  label,
  action,
  colSpan,
}: {
  label: string;
  action: () => Promise<{ error: MessageKey | null }>;
  colSpan: number;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <tr>
      <td colSpan={colSpan} className="p-1">
        <button
          type="button"
          disabled={pending}
          aria-busy={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await action();
              if (result.error) toast.error(t(result.error), { closeButton: true });
            })
          }
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:py-3",
            pending && "opacity-60",
          )}
        >
          <PlusIcon aria-hidden className="size-4" />
          {label}
        </button>
      </td>
    </tr>
  );
}
