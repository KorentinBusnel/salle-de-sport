import { z } from "zod";
import type { Proposal } from "@/lib/ai/types";

/** Blocs échangés avec le modèle (sous-ensemble du format Messages de l'API Claude). */
export type TextBlock = { type: "text"; text: string };
export type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };
export type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};
export type AgentMessage =
  | { role: "user"; content: string | ToolResultBlock[] }
  | { role: "assistant"; content: (TextBlock | ToolUseBlock)[] };

export type ToolSpec = { name: string; description: string; input_schema: Record<string, unknown> };

/** Un tour de modèle : texte diffusé au fil de l'eau, puis contenu complet et raison d'arrêt. */
export type Turn = (
  params: { system: string; messages: AgentMessage[]; tools: ToolSpec[] },
  onText: (delta: string) => void,
  signal?: AbortSignal | undefined,
) => Promise<{
  content: (TextBlock | ToolUseBlock)[];
  stopReason: string | null;
  usage: { input: number; output: number };
}>;

/**
 * Outil de l'assistant : schéma d'entrée Zod (envoyé au modèle en JSON Schema) et exécution
 * côté serveur, avec le client Supabase de l'utilisateur (la RLS s'applique).
 */
export type AgentTool<Ctx> = {
  name: string;
  description: string;
  schema: z.ZodObject;
  /** Libellé de l'étape affichée pendant l'exécution (« Recherche des adhérents… »). */
  step: string;
  run: (ctx: Ctx, input: never) => Promise<unknown>;
  /** Proposition d'action : renvoie une carte à valider, n'exécute rien. */
  proposes?: boolean;
};

export function defineTool<Ctx, S extends z.ZodObject>(tool: {
  name: string;
  description: string;
  schema: S;
  step: string;
  run: (ctx: Ctx, input: z.output<S>) => Promise<unknown>;
  proposes?: boolean;
}): AgentTool<Ctx> {
  return tool as unknown as AgentTool<Ctx>;
}

export function toolSpecs<Ctx>(tools: AgentTool<Ctx>[]): ToolSpec[] {
  return tools.map((tool) => {
    const schema = z.toJSONSchema(tool.schema, { io: "input" }) as Record<string, unknown>;
    delete schema.$schema;
    return { name: tool.name, description: tool.description, input_schema: schema };
  });
}

export const MAX_TURNS = 8;
const MAX_RESULT_CHARS = 12_000;

/**
 * Boucle d'outils : le modèle répond ou appelle des outils ; chaque résultat lui est renvoyé,
 * jusqu'à la réponse finale (au plus MAX_TURNS tours). Les propositions sont remontées à
 * l'interface et ne sont jamais exécutées ici. « Arrêter » (signal) interrompt le tour en cours :
 * le texte déjà reçu est gardé et `stopped` l'indique.
 */
export async function runAgent<Ctx>({
  turn,
  system,
  history,
  tools,
  ctx,
  onText,
  onStep,
  onProposal,
  signal,
}: {
  turn: Turn;
  system: string;
  history: AgentMessage[];
  tools: AgentTool<Ctx>[];
  ctx: Ctx;
  onText: (delta: string) => void;
  onStep: (label: string) => void;
  onProposal: (proposal: Proposal) => void;
  signal?: AbortSignal | undefined;
}) {
  const messages = [...history];
  const specs = toolSpecs(tools);
  const usage = { input: 0, output: 0 };
  const toolsUsed: string[] = [];
  const steps: string[] = [];
  const proposals: Proposal[] = [];
  let text = "";
  let stopped = false;

  for (let round = 0; round < MAX_TURNS; round++) {
    if (signal?.aborted) {
      stopped = true;
      break;
    }
    let result: Awaited<ReturnType<Turn>>;
    try {
      result = await turn(
        { system, messages, tools: specs },
        (delta) => {
          text += delta;
          onText(delta);
        },
        signal,
      );
    } catch (error) {
      if (!signal?.aborted) throw error;
      stopped = true;
      break;
    }
    usage.input += result.usage.input;
    usage.output += result.usage.output;
    messages.push({ role: "assistant", content: result.content });

    const calls = result.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
    if (result.stopReason !== "tool_use" || calls.length === 0) break;

    const results: ToolResultBlock[] = [];
    for (const call of calls) {
      const tool = tools.find((t) => t.name === call.name);
      if (!tool) {
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: "Outil inconnu.",
          is_error: true,
        });
        continue;
      }
      toolsUsed.push(tool.name);
      steps.push(tool.step);
      onStep(tool.step);
      const input = tool.schema.safeParse(call.input ?? {});
      if (!input.success) {
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: `Paramètres invalides : ${z.prettifyError(input.error)}`,
          is_error: true,
        });
        continue;
      }
      try {
        const output = await tool.run(ctx, input.data as never);
        if (tool.proposes) {
          const proposal = output as Proposal;
          proposals.push(proposal);
          onProposal(proposal);
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content:
              "Proposition affichée au gérant, en attente de sa validation. Rien n'a été envoyé ni créé.",
          });
        } else {
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: JSON.stringify(output).slice(0, MAX_RESULT_CHARS),
          });
        }
      } catch (error) {
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: `Erreur : ${error instanceof Error ? error.message : "inconnue"}`,
          is_error: true,
        });
      }
    }
    messages.push({ role: "user", content: results });
    // Sépare visuellement le texte des tours successifs.
    if (text && !text.endsWith("\n")) {
      text += "\n\n";
      onText("\n\n");
    }
  }

  return { text: text.trim(), steps, proposals, usage, toolsUsed, stopped };
}
