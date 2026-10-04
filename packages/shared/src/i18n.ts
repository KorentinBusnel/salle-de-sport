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
    return interpolate(pluralize(message, params), params);
  };
}

const pluralRules = new Intl.PluralRules("fr-FR");

/**
 * Pluriels au format ICU simplifié : `{count, plural, =0 {Aucune} one {# séance} other {# séances}}`.
 * `#` est remplacé par le nombre ; `=N` prime sur la catégorie (« one » couvre 0 et 1 en français).
 */
function pluralize(message: string, params: TranslationParams): string {
  return message.replace(
    /\{(\w+), plural,((?:\s*(?:=\d+|zero|one|two|few|many|other)\s*\{[^{}]*\})+)\s*\}/g,
    (match, name: string, body: string) => {
      const value = params[name];
      if (typeof value !== "number") return match;
      const forms = new Map<string, string>();
      for (const form of body.matchAll(/(=\d+|zero|one|two|few|many|other)\s*\{([^{}]*)\}/g)) {
        forms.set(form[1] ?? "", form[2] ?? "");
      }
      const chosen =
        forms.get(`=${value}`) ?? forms.get(pluralRules.select(value)) ?? forms.get("other");
      return chosen === undefined ? match : chosen.replaceAll("#", String(value));
    },
  );
}

function interpolate(message: string, params: TranslationParams): string {
  return message.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
