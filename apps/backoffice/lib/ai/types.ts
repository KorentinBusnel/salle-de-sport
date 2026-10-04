import type { MessageKey } from "@/lib/i18n";

/** Proposition d'action préparée par l'assistant : jamais exécutée sans validation du gérant. */
export type Proposal =
  | {
      type: "message";
      id: string;
      members: { id: string; name: string }[];
      subject: string;
      body: string;
    }
  | { type: "segment"; id: string; name: string; filters: Record<string, unknown>; count: number };

/** Événements envoyés au navigateur pendant une réponse (une ligne JSON chacun). */
export type AssistantEvent =
  | { type: "conversation"; id: string }
  | { type: "text"; delta: string }
  | { type: "step"; label: string }
  | { type: "proposal"; proposal: Proposal }
  | { type: "done" }
  | { type: "error"; message: string };

export type StepLabelKey = MessageKey;
