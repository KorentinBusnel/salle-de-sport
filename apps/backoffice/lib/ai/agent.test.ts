import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defineTool, MAX_TURNS, runAgent, toolSpecs, type Turn } from "./agent";

type Ctx = { calls: string[] };

const tools = [
  defineTool({
    name: "get_kpis",
    description: "Indicateurs",
    schema: z.object({ from: z.iso.date(), to: z.iso.date() }),
    step: "Calcul des indicateurs…",
    async run(ctx: Ctx, input) {
      ctx.calls.push(`kpis ${input.from}`);
      return { new_members: 4 };
    },
  }),
  defineTool({
    name: "propose_message",
    description: "Message à valider",
    schema: z.object({
      member_ids: z.array(z.string()).min(1),
      subject: z.string(),
      body: z.string(),
    }),
    step: "Préparation d'une proposition…",
    proposes: true,
    async run(ctx: Ctx, input) {
      ctx.calls.push("propose");
      return { type: "message", id: "p1", members: [], subject: input.subject, body: input.body };
    },
  }),
];

/** Faux modèle : rejoue une liste de réponses et enregistre ce qu'il reçoit. */
function scripted(replies: Awaited<ReturnType<Turn>>[]) {
  const seen: Parameters<Turn>[0][] = [];
  const turn: Turn = async (params, onText) => {
    seen.push(structuredClone(params));
    const reply = replies.shift();
    if (!reply) throw new Error("plus de réponse");
    for (const block of reply.content) if (block.type === "text") onText(block.text);
    return reply;
  };
  return { turn, seen };
}
const usage = { input: 10, output: 5 };

describe("toolSpecs", () => {
  it("convertit les schémas Zod en JSON Schema", () => {
    const [spec] = toolSpecs(tools);
    expect(spec?.input_schema).toMatchObject({ type: "object", required: ["from", "to"] });
    expect(spec?.input_schema).not.toHaveProperty("$schema");
  });
});

describe("runAgent", () => {
  it("exécute les outils puis renvoie la réponse finale", async () => {
    const { turn, seen } = scripted([
      {
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "get_kpis",
            input: { from: "2026-10-01", to: "2026-10-04" },
          },
        ],
        stopReason: "tool_use",
        usage,
      },
      { content: [{ type: "text", text: "4 nouvelles fiches." }], stopReason: "end_turn", usage },
    ]);
    const ctx: Ctx = { calls: [] };
    const onStep = vi.fn();
    const result = await runAgent({
      turn,
      system: "s",
      history: [{ role: "user", content: "Semaine ?" }],
      tools,
      ctx,
      onText: () => {},
      onStep,
      onProposal: () => {},
    });
    expect(ctx.calls).toEqual(["kpis 2026-10-01"]);
    expect(onStep).toHaveBeenCalledWith("Calcul des indicateurs…");
    expect(result.text).toBe("4 nouvelles fiches.");
    expect(result.usage).toEqual({ input: 20, output: 10 });
    const last = seen[1]?.messages.at(-1);
    expect(last).toMatchObject({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "t1" }],
    });
  });

  it("refuse des paramètres invalides sans exécuter l'outil", async () => {
    const { turn, seen } = scripted([
      {
        content: [{ type: "tool_use", id: "t1", name: "get_kpis", input: { from: "hier" } }],
        stopReason: "tool_use",
        usage,
      },
      { content: [{ type: "text", text: "Désolé." }], stopReason: "end_turn", usage },
    ]);
    const ctx: Ctx = { calls: [] };
    await runAgent({
      turn,
      system: "s",
      history: [],
      tools,
      ctx,
      onText: () => {},
      onStep: () => {},
      onProposal: () => {},
    });
    expect(ctx.calls).toEqual([]);
    expect(seen[1]?.messages.at(-1)).toMatchObject({ content: [{ is_error: true }] });
  });

  it("une proposition est remontée à l'interface, jamais exécutée", async () => {
    const { turn, seen } = scripted([
      {
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "propose_message",
            input: { member_ids: ["m1"], subject: "Relance", body: "Bonjour" },
          },
        ],
        stopReason: "tool_use",
        usage,
      },
      { content: [{ type: "text", text: "Message prêt." }], stopReason: "end_turn", usage },
    ]);
    const onProposal = vi.fn();
    const result = await runAgent({
      turn,
      system: "s",
      history: [],
      tools,
      ctx: { calls: [] },
      onText: () => {},
      onStep: () => {},
      onProposal,
    });
    expect(onProposal).toHaveBeenCalledWith(
      expect.objectContaining({ type: "message", subject: "Relance" }),
    );
    expect(result.proposals).toHaveLength(1);
    const toolResult = JSON.stringify(seen[1]?.messages.at(-1));
    expect(toolResult).toContain("en attente de sa validation");
  });

  it("s'arrête après MAX_TURNS tours d'outils", async () => {
    const loop = Array.from({ length: MAX_TURNS + 2 }, (_, i) => ({
      content: [
        {
          type: "tool_use" as const,
          id: `t${i}`,
          name: "get_kpis",
          input: { from: "2026-10-01", to: "2026-10-02" },
        },
      ],
      stopReason: "tool_use",
      usage,
    }));
    const { turn, seen } = scripted(loop);
    await runAgent({
      turn,
      system: "s",
      history: [],
      tools,
      ctx: { calls: [] },
      onText: () => {},
      onStep: () => {},
      onProposal: () => {},
    });
    expect(seen).toHaveLength(MAX_TURNS);
  });

  it("outil inconnu : erreur renvoyée au modèle", async () => {
    const { turn, seen } = scripted([
      {
        content: [{ type: "tool_use", id: "t1", name: "drop_table", input: {} }],
        stopReason: "tool_use",
        usage,
      },
      { content: [{ type: "text", text: "ok" }], stopReason: "end_turn", usage },
    ]);
    await runAgent({
      turn,
      system: "s",
      history: [],
      tools,
      ctx: { calls: [] },
      onText: () => {},
      onStep: () => {},
      onProposal: () => {},
    });
    expect(JSON.stringify(seen[1]?.messages.at(-1))).toContain("Outil inconnu");
  });

  it("« Arrêter » : garde le texte reçu et n'appelle plus le modèle", async () => {
    const controller = new AbortController();
    let calls = 0;
    const turn: Turn = async (_params, onText, signal) => {
      calls++;
      onText("Début de réponse");
      controller.abort();
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
      return { content: [], stopReason: "end_turn", usage };
    };
    const result = await runAgent({
      turn,
      system: "s",
      history: [],
      tools,
      ctx: { calls: [] },
      onText: () => {},
      onStep: () => {},
      onProposal: () => {},
      signal: controller.signal,
    });
    expect(calls).toBe(1);
    expect(result).toMatchObject({ text: "Début de réponse", stopped: true });
  });

  it("une erreur hors arrêt remonte", async () => {
    const turn: Turn = async () => {
      throw new Error("réseau");
    };
    await expect(
      runAgent({
        turn,
        system: "s",
        history: [],
        tools,
        ctx: { calls: [] },
        onText: () => {},
        onStep: () => {},
        onProposal: () => {},
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("réseau");
  });
});
