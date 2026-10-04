import { fr } from "@/messages/fr";

type Leaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<typeof fr>;

/** Traduit une clé (« dashboard.places ») et remplace les paramètres {nom}. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let node: unknown = fr;
  for (const part of key.split(".")) {
    node = (node as Record<string, unknown>)[part];
  }
  const message = typeof node === "string" ? node : key;
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
