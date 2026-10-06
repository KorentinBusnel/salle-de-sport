import "server-only";
import { z } from "zod";

/**
 * Variables serveur de la liste d'attente (jamais exposées au navigateur). Toutes facultatives au
 * build : sans Supabase, l'inscription répond « erreur » ; sans Resend, elle réussit sans email.
 */
const serverEnvSchema = z.object({
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM: z.string().min(3).optional(),
});

export function serverEnv() {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL || undefined,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    RESEND_FROM: process.env.RESEND_FROM || undefined,
  });
  const env = parsed.success ? parsed.data : {};
  return {
    supabase:
      env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
        ? { url: env.SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY }
        : null,
    resend:
      env.RESEND_API_KEY && env.RESEND_FROM
        ? { apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM }
        : null,
  };
}
