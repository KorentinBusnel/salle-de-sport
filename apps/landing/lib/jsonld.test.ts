import { describe, expect, it } from "vitest";
import { brand, faq } from "@/content/landing";
import { buildJsonLd, serializeJsonLd } from "./jsonld";

const base = new URL("https://kettl.ai");
const graph = buildJsonLd(base)["@graph"];
const byType = (type: string) =>
  graph.find((node) => node["@type"] === type) as Record<string, unknown>;

describe("JSON-LD", () => {
  it("décrit l'organisation, le site, le logiciel et la FAQ", () => {
    expect(graph.map((node) => node["@type"])).toEqual([
      "Organization",
      "WebSite",
      "SoftwareApplication",
      "FAQPage",
    ]);
    expect(byType("Organization")).toMatchObject({
      name: brand.name,
      url: "https://kettl.ai/",
      logo: "https://kettl.ai/logo.png",
      email: brand.contactEmail,
    });
  });

  it("logiciel : catégorie, systèmes et tarif fondateur, sans note ni avis inventés", () => {
    const software = byType("SoftwareApplication");
    expect(software).toMatchObject({
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      offers: { price: "99", priceCurrency: "EUR", description: "Tarif fondateur, par mois" },
    });
    expect(software).not.toHaveProperty("aggregateRating");
    expect(software).not.toHaveProperty("review");
  });

  it("FAQPage reprend mot pour mot la FAQ affichée", () => {
    const entities = byType("FAQPage").mainEntity as {
      name: string;
      acceptedAnswer: { text: string };
    }[];
    expect(entities.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(
      faq.items.map((item) => [item.question, item.answer]),
    );
  });

  it("sérialisation sans « < » brut", () => {
    expect(serializeJsonLd({ a: "</script><script>" })).not.toContain("<");
  });
});
