"use client";

import { PlusIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type MessageKey, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type CreateAction = () => Promise<{ error: MessageKey | null; id?: string | undefined }>;

/** Création, puis la nouvelle ligne prend le focus (`?n=<id>`, voir `FocusRow`). */
function useCreate(action: CreateAction) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const run = () =>
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(t(result.error), { closeButton: true });
      else if (result.id) {
        // Les autres paramètres (section des Paramètres, filtres) sont gardés.
        const next = new URLSearchParams(params.toString());
        next.set("n", result.id);
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      }
    });
  return { pending, run };
}

/** Ligne « + Nouveau » d'un tableau éditable : crée avec les valeurs par défaut. */
export function AddRow({
  label,
  action,
  colSpan,
}: {
  label: string;
  action: CreateAction;
  colSpan: number;
}) {
  const { pending, run } = useCreate(action);
  return (
    <tr>
      <td colSpan={colSpan} className="p-1">
        <button
          type="button"
          disabled={pending}
          aria-busy={pending}
          onClick={run}
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

/** Même création depuis un bouton (état vide). */
export function AddButton({ label, action }: { label: string; action: CreateAction }) {
  const { pending, run } = useCreate(action);
  return (
    <Button type="button" disabled={pending} onClick={run}>
      <PlusIcon data-icon="inline-start" aria-hidden />
      {label}
    </Button>
  );
}

/**
 * Ligne tout juste créée (brouillon) : elle reçoit le focus sur sa première cellule et défile
 * dans la vue, pour la compléter au clavier.
 */
export function FocusRow({ id }: { id: string }) {
  useEffect(() => {
    const row = document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`);
    row?.scrollIntoView({ block: "nearest" });
    row?.querySelector<HTMLElement>("button, input, [tabindex='0']")?.focus();
  }, [id]);
  return null;
}
