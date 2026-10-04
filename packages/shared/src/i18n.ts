/**
 * Traduction par clés (BRIEF §10.8) : un catalogue de messages imbriqué, des clés
 * à points typées (« dashboard.places ») et des paramètres {nom}.
 */

export type Messages = { readonly [key: string]: string | Messages };

/** Toutes les clés à points d'un catalogue. */
export type MessageKey<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : MessageKey<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationParams = Record<string, string | number>;

export function createTranslator<T extends Messages>(messages: T) {
  return function t(key: MessageKey<T>, params?: TranslationParams): string {
    let node: unknown = messages;
    for (const part of (key as string).split(".")) {
      node = (node as Record<string, unknown> | undefined)?.[part];
    }
    const message = typeof node === "string" ? node : key;
    if (!params) return message;
    return message.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  };
}
