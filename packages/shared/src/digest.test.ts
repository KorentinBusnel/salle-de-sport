import { describe, expect, it } from "vitest";
import { dailyDigestSchema, digestInputSchema, openDigestItems } from "./digest.ts";

const item = (id: string) => ({
  id,
  source: "payments",
  from: "Prélèvement rejeté",
  read: "Thomas Girard — 69 € — 2e rejet.",
  action: "Relancer Thomas par WhatsApp",
  cta: "Relancer",
  prompt: "Prépare une relance pour Thomas Girard.",
});
const digest = {
  brief: {
    text: "Relancez Thomas.",
    actions: [{ label: "Relancer", prompt: "Prépare la relance." }],
  },
  categories: [
    { key: "operations", summary: "Rien d'urgent.", items: [] },
    { key: "clients", summary: "Répondez à Sarah.", items: [item("c1")] },
    { key: "finance", summary: "Relancez Thomas.", items: [item("f1"), item("f2")] },
  ],
};

describe("digest", () => {
  it("accepte un digest complet et ajoute la liste des actions écartées", () => {
    expect(dailyDigestSchema.parse(digest).dismissed).toEqual([]);
  });

  it("exige les trois catégories", () => {
    const missing = { ...digest, categories: digest.categories.slice(0, 2) };
    expect(digestInputSchema.safeParse(missing).success).toBe(false);
    const doubled = {
      ...digest,
      categories: [digest.categories[0], digest.categories[0], digest.categories[2]],
    };
    expect(digestInputSchema.safeParse(doubled).success).toBe(false);
  });

  it("limite le brief à deux actions", () => {
    const action = { label: "A", prompt: "B" };
    const tooMany = { ...digest, brief: { text: "x", actions: [action, action, action] } };
    expect(digestInputSchema.safeParse(tooMany).success).toBe(false);
  });

  it("refuse une source inconnue", () => {
    const bad = {
      ...digest,
      categories: [
        digest.categories[0],
        digest.categories[1],
        { key: "finance", summary: "x", items: [{ ...item("f1"), source: "slack" }] },
      ],
    };
    expect(digestInputSchema.safeParse(bad).success).toBe(false);
  });

  it("retire les actions écartées", () => {
    const parsed = dailyDigestSchema.parse({ ...digest, dismissed: ["f1"] });
    expect(openDigestItems(parsed).map((i) => i.id)).toEqual(["c1", "f2"]);
  });
});
