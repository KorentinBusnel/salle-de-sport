import "server-only";
import { z } from "zod";
import { BRAND } from "@/lib/site";

const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

/**
 * Supabase pour le formulaire de démo (clé anon, filtrée par la RLS). Lu à l'appel : la page
 * est statique et se construit sans ces variables ; sans elles, l'envoi échoue proprement.
 */
export function supabaseEnv() {
  const parsed = supabaseEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return parsed.success ? parsed.data : null;
}

const notifyEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  DEMO_NOTIFY_EMAIL: z.email(),
  DEMO_NOTIFY_FROM: z.string().min(3).optional(),
});

/**
 * Alerte email des demandes de démo (Resend), secrets côté serveur : null si la clé ou le
 * destinataire manquent, et l'alerte n'est alors pas envoyée.
 */
export function notifyEnv() {
  const parsed = notifyEnvSchema.safeParse({
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    DEMO_NOTIFY_EMAIL: process.env.DEMO_NOTIFY_EMAIL || undefined,
    DEMO_NOTIFY_FROM: process.env.DEMO_NOTIFY_FROM || undefined,
  });
  if (!parsed.success) return null;
  return {
    apiKey: parsed.data.RESEND_API_KEY,
    to: parsed.data.DEMO_NOTIFY_EMAIL,
    from: parsed.data.DEMO_NOTIFY_FROM ?? `${BRAND.name} <onboarding@resend.dev>`,
  };
}
