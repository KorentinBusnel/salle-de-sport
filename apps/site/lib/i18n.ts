import { createTranslator, type MessageKey as Key, type TranslationParams } from "@salle/shared";
import { BRAND } from "@/lib/site";
import { fr } from "@/messages/fr";

export type MessageKey = Key<typeof fr>;

const translate = createTranslator(fr);

/**
 * Typographie française : espace insécable avant « ? ! : ; » et à l'intérieur des guillemets,
 * pour qu'aucun signe ne se retrouve seul en début de ligne.
 */
export function frenchSpacing(text: string): string {
  return text.replace(/ ([?!:;»])/g, " $1").replace(/« /g, "« ");
}

export function t(key: MessageKey, params?: TranslationParams): string {
  return frenchSpacing(translate(key, { brand: BRAND.name, ...params }));
}
