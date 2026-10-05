"use client";

import { toast } from "sonner";
import { type MessageKey, t } from "@/lib/i18n";

/** Durée laissée pour annuler (WCAG 2.2.1 : assez longue, et le toast reste au survol). */
export const UNDO_DURATION_MS = 10_000;

type Outcome = { error: MessageKey } | { error?: null | undefined };

/**
 * Action réversible avec « Annuler » à la place d'une confirmation (Watermelon sonner-6,
 * timed-undo-action).
 *
 * - mode « inverse » : `run` part tout de suite ; « Annuler » appelle `undo` (l'action
 *   contraire). À utiliser quand l'action est sans effet de bord externe (statut, tag…).
 * - mode « différé » : rien ne part avant la fin du délai ; « Annuler » abandonne. Si le
 *   toast est fermé à la main, l'action part aussi. Si l'onglet se ferme avant, elle ne part
 *   pas (sens sûr).
 */
export function toastUndo(options: {
  message: string;
  mode: "inverse" | "deferred";
  run: () => Promise<Outcome>;
  undo?: (() => Promise<Outcome>) | undefined;
  onSettled?: (() => void) | undefined;
}) {
  const report = (outcome: Outcome) => {
    if (outcome.error) toast.error(t(outcome.error), { closeButton: true });
    options.onSettled?.();
  };

  if (options.mode === "inverse") {
    void options.run().then((outcome) => {
      if (outcome.error) return report(outcome);
      options.onSettled?.();
      toast.success(options.message, {
        duration: UNDO_DURATION_MS,
        action: options.undo
          ? {
              label: t("ui.undo"),
              onClick: () => {
                void options.undo?.().then((undone) => {
                  if (undone.error) report(undone);
                  else {
                    toast(t("ui.undone"));
                    options.onSettled?.();
                  }
                });
              },
            }
          : undefined,
      });
    });
    return;
  }

  let cancelled = false;
  let started = false;
  const start = () => {
    if (cancelled || started) return;
    started = true;
    void options.run().then(report);
  };
  toast(options.message, {
    duration: UNDO_DURATION_MS,
    action: {
      label: t("ui.undo"),
      onClick: () => {
        cancelled = true;
        toast(t("ui.undone"));
      },
    },
    onAutoClose: start,
    onDismiss: start,
  });
}
