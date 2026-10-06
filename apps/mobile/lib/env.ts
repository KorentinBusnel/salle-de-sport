import { z } from "zod";

// Variables publiques embarquées dans l'app : la clé anon est filtrée par la RLS.
const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // Clé publiable Stripe (publique) : sans elle, l'achat dans l'app reste masqué.
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .optional()
    .transform((v) => (v?.startsWith("pk_") ? v : undefined)),
});

// Accès explicites : Expo n'injecte que les EXPO_PUBLIC_* référencées littéralement.
export const env = envSchema.parse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
});
