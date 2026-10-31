import { t } from "@/lib/i18n";

/**
 * Alerte email d'une nouvelle demande de démo, envoyée à l'équipe par Resend après la réponse au
 * visiteur (app/actions.ts). Sans `server-only`, pour être testée ; la clé n'est lue que côté
 * serveur (lib/notify.server.ts).
 */
export type NotifyConfig = { apiKey: string; to: string; from: string };
export type DemoMessage = { subject: string; text: string; replyTo: string };
export type NotifyResult = { ok: true } | { ok: false; error: string };

const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 5000;

// Date et heure de la demande, à l'heure de Paris (l'équipe est en France).
const when = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "long",
  timeStyle: "short",
});

/** Objet et texte de l'alerte ; « Répondre » écrit directement au demandeur. */
export function demoNotification(email: string, at: Date): DemoMessage {
  return {
    subject: t("notify.subject", { email }),
    text: t("notify.body", { email, date: when.format(at) }),
    replyTo: email,
  };
}

/** Envoi par l'API Resend, sans lever d'erreur : le résultat dit ce qui s'est passé. */
export async function sendDemoNotification(
  config: NotifyConfig,
  message: DemoMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<NotifyResult> {
  try {
    const response = await fetchImpl(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [config.to],
        subject: message.subject,
        text: message.text,
        reply_to: message.replyTo,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status} ${(await response.text()).slice(0, 200)}`,
      };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
