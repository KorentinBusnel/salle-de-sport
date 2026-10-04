import "server-only";
import { z } from "zod";

/**
 * Variables serveur de l'assistant (jamais exposées au navigateur). La clé est facultative :
 * sans elle, l'assistant s'affiche « non configuré ».
 */
const aiEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-5-5"),
});

export function aiEnv() {
  const parsed = aiEnvSchema.safeParse({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || undefined,
  });
  return parsed.success
    ? { apiKey: parsed.data.ANTHROPIC_API_KEY ?? null, model: parsed.data.ANTHROPIC_MODEL }
    : { apiKey: null, model: "claude-sonnet-5-5" };
}
