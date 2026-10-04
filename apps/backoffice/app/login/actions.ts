"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { MessageKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type SignInState = { error: MessageKey | null };

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "login.invalidInput" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "login.invalidCredentials" };

  redirect("/");
}
