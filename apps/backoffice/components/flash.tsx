import { asMessageKey } from "@/lib/flash";
import { t } from "@/lib/i18n";

/** Message de retour d'une action, transmis par l'URL (?ok=… ou ?erreur=…). */
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
    <p
      role={errorKey ? "alert" : "status"}
      className={
        errorKey
          ? "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          : "rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success"
      }
    >
      {t(errorKey ?? okKey ?? "common.saved")}
    </p>
  );
}
