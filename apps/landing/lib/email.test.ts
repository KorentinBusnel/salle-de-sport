import { afterEach, describe, expect, it, vi } from "vitest";
import { brand } from "@/content/landing";
import { confirmationHtml, confirmationText, sendConfirmation } from "./email";

const resend = { apiKey: "re_test", from: "Kettl <bonjour@kettl.ai>" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("email de confirmation", () => {
  it("texte et HTML reprennent le lancement, le tarif et la désinscription", () => {
    const text = confirmationText("https://kettl.ai/");
    expect(text).toContain("début 2027");
    expect(text).toContain("99 €");
    expect(text).toContain("désinscription");
    const html = confirmationHtml("https://kettl.ai/");
    expect(html).toContain('lang="fr"');
    expect(html).toContain("L'équipe Kettl");
    expect(html).not.toContain("<script");
  });

  it("appelle Resend avec la clé, l'expéditeur, la réponse au contact et une clé d'idempotence", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendConfirmation(resend, "a@b.fr", "id-1", "https://kettl.ai/")).resolves.toBe(
      true,
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test");
    expect(headers["Idempotency-Key"]).toBe("waitlist-id-1");
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: resend.from,
      to: ["a@b.fr"],
      reply_to: brand.contactEmail,
    });
  });

  it("un refus ou une panne de Resend ne lève pas d'erreur", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 422 })));
    await expect(sendConfirmation(resend, "a@b.fr", "id-2", "https://kettl.ai/")).resolves.toBe(
      false,
    );
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("réseau")));
    await expect(sendConfirmation(resend, "a@b.fr", "id-3", "https://kettl.ai/")).resolves.toBe(
      false,
    );
  });
});
