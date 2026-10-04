import { bookingErrorCode } from "@salle/shared";
import { type MessageKey, t } from "@/lib/i18n";

/** Message à afficher pour une erreur Supabase (codes métier des fonctions SQL traduits). */
export function errorText(error: { message?: string } | null | undefined): string {
  const code = bookingErrorCode(error);
  const key: MessageKey = code ? `bookingErrors.${code}` : "common.unexpectedError";
  return t(key);
}
