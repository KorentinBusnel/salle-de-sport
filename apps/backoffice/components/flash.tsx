import { asMessageKey } from "@/lib/flash";
import { t } from "@/lib/i18n";

/**
 * Message de retour d'une action (?ok=… ou ?erreur=…) pour les navigateurs sans
 * JavaScript ; sinon FlashToast l'affiche en toast.
 */
export function Flash({
  ok,
  error,
}: {
  ok?: string | string[] | undefined;
  error?: string | string[] | undefined;
}) {
  const okKey = asMessageKey(Array.isArray(ok) ? ok[0] : ok);
  const errorKey = asMessageKey(Array.isArray(error) ? error[0] : error);
  if (!okKey && !errorKey) return null;
  return (
    <noscript>
      <p
        role={errorKey ? "alert" : "status"}
        className={
          errorKey
            ? "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            : "rounded-lg bg-success/10 px-3 py-2 text-sm text-success"
        }
      >
        {t(errorKey ?? okKey ?? "common.saved")}
      </p>
    </noscript>
  );
}
