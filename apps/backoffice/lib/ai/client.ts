import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import { aiEnv } from "@/lib/env.server";
import type { TextBlock, ToolUseBlock, Turn } from "@/lib/ai/agent";

/**
 * Tour de conversation avec l'API Claude, en streaming. baseURL explicite : la session cloud de
 * développement définit ANTHROPIC_BASE_URL pour Claude Code, à ne pas réutiliser ici.
 */
export function anthropicTurn(): { turn: Turn; model: string } | null {
  const env = aiEnv();
  if (!env.apiKey) return null;
  const client = new Anthropic({ apiKey: env.apiKey, baseURL: "https://api.anthropic.com" });
  const turn: Turn = async ({ system, messages, tools }, onText, signal) => {
    const stream = client.messages.stream(
      {
        model: env.model,
        max_tokens: 2048,
        system,
        messages: messages as MessageParam[],
        tools: tools as Tool[],
      },
      signal ? { signal } : undefined,
    );
    stream.on("text", onText);
    const message = await stream.finalMessage();
    return {
      content: message.content.flatMap((block): (TextBlock | ToolUseBlock)[] =>
        block.type === "text"
          ? [{ type: "text" as const, text: block.text }]
          : block.type === "tool_use"
            ? [{ type: "tool_use" as const, id: block.id, name: block.name, input: block.input }]
            : [],
      ),
      stopReason: message.stop_reason,
      usage: { input: message.usage.input_tokens, output: message.usage.output_tokens },
    };
  };
  return { turn, model: env.model };
}
