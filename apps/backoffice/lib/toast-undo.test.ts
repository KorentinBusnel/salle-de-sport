import { beforeEach, describe, expect, it, vi } from "vitest";

type ToastOptions = {
  action?: { onClick: () => void };
  onAutoClose?: () => void;
  onDismiss?: () => void;
};
const calls: { message: string; options: ToastOptions }[] = [];
vi.mock("sonner", () => {
  const toast = Object.assign(
    (message: string, options: ToastOptions = {}) => calls.push({ message, options }),
    {
      success: (message: string, options: ToastOptions = {}) => calls.push({ message, options }),
      error: (message: string, options: ToastOptions = {}) => calls.push({ message, options }),
    },
  );
  return { toast };
});

const { toastUndo } = await import("./toast-undo");
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("toastUndo", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("différé : rien ne part avant la fin du délai, Annuler abandonne", async () => {
    const run = vi.fn(async () => ({}));
    toastUndo({ message: "Tag retiré", mode: "deferred", run });
    expect(run).not.toHaveBeenCalled();
    calls[0]?.options.action?.onClick();
    calls[0]?.options.onAutoClose?.();
    await flush();
    expect(run).not.toHaveBeenCalled();
  });

  it("différé : part à la fermeture, une seule fois", async () => {
    const run = vi.fn(async () => ({}));
    toastUndo({ message: "Tag retiré", mode: "deferred", run });
    calls[0]?.options.onAutoClose?.();
    calls[0]?.options.onDismiss?.();
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("inverse : part tout de suite, Annuler appelle l'action contraire", async () => {
    const run = vi.fn(async () => ({}));
    const undo = vi.fn(async () => ({}));
    toastUndo({ message: "Adhérent suspendu", mode: "inverse", run, undo });
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
    calls.at(-1)?.options.action?.onClick();
    await flush();
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("inverse : en cas d'erreur, pas de proposition d'annulation", async () => {
    const run = vi.fn(async () => ({ error: "common.unexpectedError" as const }));
    const undo = vi.fn(async () => ({}));
    toastUndo({ message: "Adhérent suspendu", mode: "inverse", run, undo });
    await flush();
    expect(calls.some((c) => c.options.action)).toBe(false);
  });
});
