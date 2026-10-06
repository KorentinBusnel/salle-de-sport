import type { MessageKey } from "@/lib/i18n";

/**
 * Résultat d'une Server Action appelée côté client : pas de redirection, le client affiche
 * un toast et rafraîchit ce qui doit l'être (refresh()). `count` alimente un pluriel.
 */
export type ActionResult<T = undefined> =
  | ({
      ok: true;
      message?: MessageKey | undefined;
      count?: number | undefined;
    } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: MessageKey };

export const ok = (message?: MessageKey, count?: number): ActionResult => ({
  ok: true,
  ...(message ? { message } : {}),
  ...(count !== undefined ? { count } : {}),
});

export const fail = (error: MessageKey): ActionResult<never> => ({ ok: false, error });
