import { describe, expect, it, vi } from "vitest";
import { demoNotification, sendDemoNotification } from "./demo-notification";

const config = {
  apiKey: "re_test",
  to: "equipe@chalk.test",
  from: "Chalk <onboarding@resend.dev>",
};
// 31 octobre 2026, 14 h 06 UTC : 15 h 06 à Paris (heure d'hiver).
const at = new Date("2026-10-31T14:06:00Z");

describe("demoNotification", () => {
  it("objet, texte à l'heure de Paris et réponse au demandeur", () => {
    const message = demoNotification("lea@studio-nord.fr", at);
    expect(message.subject).toBe("Nouvelle demande de démo\u00a0: lea@studio-nord.fr");
    expect(message.text).toContain("lea@studio-nord.fr a demandé une démo sur le site Chalk");
    expect(message.text).toContain("31 octobre 2026");
    expect(message.text).toContain("15:06");
    expect(message.text).toContain("Répondez à cet email pour lui écrire.");
    expect(message.replyTo).toBe("lea@studio-nord.fr");
  });
});

describe("sendDemoNotification", () => {
  const message = demoNotification("lea@studio-nord.fr", at);

  it("appelle l'API Resend avec la clé, l'expéditeur, le destinataire et la réponse", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    await expect(sendDemoNotification(config, message, fetchImpl)).resolves.toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body as string)).toEqual({
      from: "Chalk <onboarding@resend.dev>",
      to: ["equipe@chalk.test"],
      subject: message.subject,
      text: message.text,
      reply_to: "lea@studio-nord.fr",
    });
  });

  it("renvoie l'erreur HTTP sans lever d'exception", async () => {
    const fetchImpl = vi.fn(async () => new Response("domaine non vérifié", { status: 403 }));
    await expect(sendDemoNotification(config, message, fetchImpl)).resolves.toEqual({
      ok: false,
      error: "HTTP 403 domaine non vérifié",
    });
  });

  it("renvoie une panne réseau ou un délai dépassé sans lever d'exception", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("The operation was aborted due to timeout");
    });
    await expect(sendDemoNotification(config, message, fetchImpl)).resolves.toEqual({
      ok: false,
      error: "The operation was aborted due to timeout",
    });
  });
});
