import { bookingErrorCode } from "@salle/shared";
import { type MessageKey, t } from "@/lib/i18n";

/** Une clé reçue dans l'URL n'est affichée que si elle existe dans le catalogue. */
export function asMessageKey(value: unknown): MessageKey | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return t(value as MessageKey) === value ? null : (value as MessageKey);
}

/** Ajoute un message de retour (succès ou erreur) à une URL, pour l'afficher après redirection. */
export function withFlash(
  path: string,
  flash: { ok?: MessageKey; error?: MessageKey; count?: number },
): string {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.delete("ok");
  params.delete("erreur");
  params.delete("n");
  if (flash.ok) params.set("ok", flash.ok);
  if (flash.error) params.set("erreur", flash.error);
  // Nombre pour les messages au pluriel ({count, plural, …}).
  if (flash.count !== undefined) params.set("n", String(flash.count));
  const search = params.toString();
  return search ? `${base}?${search}` : (base ?? path);
}

/** Message à afficher pour une erreur des fonctions SQL de réservation. */
export function errorMessageKey(error: { message?: string } | null): MessageKey {
  const code = bookingErrorCode(error);
  return code ? `bookingErrors.${code}` : "common.unexpectedError";
}

/** Paramètres d'un message flash : le nombre éventuel (`?n=`). */
export function flashParams(n: unknown): { count: number } | undefined {
  const count = typeof n === "string" ? Number.parseInt(n, 10) : Number.NaN;
  return Number.isFinite(count) ? { count } : undefined;
}
