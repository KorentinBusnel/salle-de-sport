import { describe, expect, it } from "vitest";
import { buildReceipt, pdfText, receiptNumber } from "./receipt";

describe("reçu de paiement", () => {
  it("numérote par date locale de la salle et identifiant", () => {
    // 23 h 30 UTC le 31 décembre = 1er janvier à Paris.
    expect(receiptNumber("7b20af12-3f21-4f9d", "2026-12-31T23:30:00Z", "Europe/Paris")).toBe(
      "R-20270101-7B20AF12",
    );
  });

  it("rend le texte encodable (espaces fines, caractères hors police)", () => {
    expect(pdfText("180,00 € — « Été »")).toBe("180,00 € — « Été »");
    expect(pdfText("Ă")).toBe("?");
  });

  it("produit un PDF", async () => {
    const bytes = await buildReceipt({
      paymentId: "7b20af12-3f21-4f9d-b8fc-da2eb8a014aa",
      paidAt: "2026-10-06T10:00:00Z",
      timeZone: "Europe/Paris",
      gym: {
        name: "Atlas Training Club",
        address: "1 rue du Sport, Lyon",
        email: null,
        phone: null,
      },
      member: { name: "Camille Martin", email: "camille@example.com" },
      label: "Carnet 10 séances",
      promoCode: "BIENVENUE",
      method: "Carte",
      amount: "160,00 €",
      refunded: false,
    });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
