import { createTranslator, type MessageKey as Key } from "@salle/shared";
import { fr } from "@/messages/fr";

export type MessageKey = Key<typeof fr>;

export const t = createTranslator(fr);
