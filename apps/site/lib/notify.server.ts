import "server-only";
import { demoNotification, sendDemoNotification } from "@/lib/demo-notification";
import { notifyEnv } from "@/lib/env.server";

/**
 * Alerte de l'équipe pour une nouvelle demande de démo. Sans configuration, rien n'est envoyé ;
 * un échec est journalisé, jamais montré au visiteur (l'envoi part après sa réponse).
 */
export async function notifyDemoRequest(email: string, at: Date = new Date()): Promise<void> {
  const config = notifyEnv();
  if (!config) {
    console.info("Alerte de démo non envoyée : RESEND_API_KEY ou DEMO_NOTIFY_EMAIL manquante.");
    return;
  }
  const result = await sendDemoNotification(config, demoNotification(email, at));
  if (!result.ok) console.error("Alerte de démo : l'envoi par Resend a échoué.", result.error);
}
