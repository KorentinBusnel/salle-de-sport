"use client";

import { toast } from "sonner";
import { type MessageKey, t } from "@/lib/i18n";

/**
 * Action longue suivie dans un seul toast (Watermelon sonner-7, toast.promise) : « en
 * cours… », puis succès ou erreur traduite. L'action renvoie `{ error }` comme nos Server
 * Actions.
 */
export function toastAction<R extends { error?: MessageKey | null | undefined }>(
  run: () => Promise<R>,
  messages: { loading: string; success: string | ((result: R) => string) },
): Promise<R> {
  const promise = run().then((result) => {
    if (result.error) throw result;
    return result;
  });
  toast.promise(promise, {
    loading: messages.loading,
    success: (result: R) =>
      typeof messages.success === "function" ? messages.success(result) : messages.success,
    error: (failure: R | Error) =>
      failure instanceof Error || !failure.error ? t("common.unexpectedError") : t(failure.error),
  });
  return promise.catch((failure: R | Error) =>
    failure instanceof Error ? ({ error: "common.unexpectedError" } as R) : failure,
  );
}
