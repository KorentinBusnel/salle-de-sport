"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { MessageKey } from "@/lib/i18n";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type SignInState = { error: MessageKey | null; detail?: string };

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "login.invalidInput" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error?.code === "invalid_credentials") return { error: "login.invalidCredentials" };
  if (error) {
    // Autre échec (URL ou clé Supabase erronée, service injoignable) : visible dans les logs
    // d'exécution et à l'écran, avec l'hôte Supabase visé (valeur publique).
    console.error("Connexion Supabase impossible", error.status, error.code, error.message);
    return {
      error: "login.serviceError",
      detail: `${new URL(publicEnv.NEXT_PUBLIC_SUPABASE_URL).host} · ${error.code ?? error.status ?? error.name}`,
    };
  }

  redirect("/");
}
