import "server-only";
import { confirmationEmail as c } from "@/content/email";
import { brand } from "@/content/landing";
import { colors } from "@/lib/tokens";

const RESEND_URL = "https://api.resend.com/emails";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function confirmationText(siteUrl: string): string {
  return [
    c.greeting,
    "",
    c.intro,
    "",
    c.pitch,
    "",
    c.nextTitle,
    ...c.next.map((line) => `- ${line}`),
    "",
    c.outro,
    "",
    c.signature,
    siteUrl,
    "",
    "—",
    c.footer,
  ].join("\n");
}

export function confirmationHtml(siteUrl: string): string {
  const p = (text: string) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${colors.foreground}">${escapeHtml(text)}</p>`;
  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:32px 16px;background:${colors.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px;background:${colors.card};border:1px solid ${colors.border};border-radius:16px">
<p style="margin:0 0 24px;font-family:Georgia,serif;font-size:28px;font-weight:500;letter-spacing:-0.03em;color:${colors.foreground}">${brand.wordmark}<span style="color:${colors.primary}">.</span></p>
${p(c.greeting)}${p(c.intro)}${p(c.pitch)}
<p style="margin:0 0 8px;font-size:16px;line-height:1.55;color:${colors.foreground}">${escapeHtml(c.nextTitle)}</p>
<ul style="margin:0 0 16px;padding-left:20px;font-size:16px;line-height:1.55;color:${colors.foreground}">${c.next.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
${p(c.outro)}
<p style="margin:0;font-size:16px;line-height:1.55;color:${colors.foreground}">${escapeHtml(c.signature)}<br><a href="${escapeHtml(siteUrl)}" style="color:${colors["primary-hover"]}">${escapeHtml(brand.domain)}</a></p>
</div>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:${colors["muted-foreground"]}">${escapeHtml(c.footer)}</p>
</body></html>`;
}

/**
 * Envoie l'email de confirmation d'une nouvelle inscription. Idempotent par inscription
 * (Idempotency-Key) : un nouvel essai n'envoie pas de doublon. Ne lève jamais : un échec est
 * journalisé, l'inscription reste valable.
 */
export async function sendConfirmation(
  resend: { apiKey: string; from: string },
  to: string,
  signupId: string,
  siteUrl: string,
): Promise<boolean> {
  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `waitlist-${signupId}`,
      },
      body: JSON.stringify({
        from: resend.from,
        to: [to],
        reply_to: brand.contactEmail,
        subject: c.subject,
        text: confirmationText(siteUrl),
        html: confirmationHtml(siteUrl),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error(`Resend : envoi refusé (${response.status}) ${await response.text()}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Resend : envoi impossible", error);
    return false;
  }
}
