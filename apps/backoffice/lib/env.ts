import { z } from "zod";

// Variables publiques uniquement : la clé anon est filtrée par la RLS.
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

// Accès explicites : Next.js n'injecte que les NEXT_PUBLIC_* référencées littéralement.
const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  // Message explicite dans les logs de build (Vercel, CI) : quelles variables manquent ou sont invalides.
  const names = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
  throw new Error(
    `Variables d'environnement manquantes ou invalides : ${names.join(", ")}. ` +
      "Renseignez-les (voir .env.example) pour cet environnement : en local avec `pnpm env:local`, " +
      "sur Vercel dans Settings → Environment Variables (Production et Preview).",
  );
}

export const publicEnv = parsed.data;
