import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "./env";

describe("resolveSiteUrl", () => {
  it("prend l'adresse déclarée, sans barre finale", () => {
    expect(resolveSiteUrl({ declared: "https://chalq.fr/", productionHost: "x.vercel.app" })).toBe(
      "https://chalq.fr",
    );
  });

  it("prend le domaine de production de Vercel en production", () => {
    expect(
      resolveSiteUrl({
        vercelEnv: "production",
        productionHost: "salle-de-sport-zasm.vercel.app",
        deploymentHost: "salle-de-sport-zasm-abc123.vercel.app",
      }),
    ).toBe("https://salle-de-sport-zasm.vercel.app");
  });

  it("prend l'adresse du déploiement en preview", () => {
    expect(
      resolveSiteUrl({
        vercelEnv: "preview",
        productionHost: "salle-de-sport-zasm.vercel.app",
        deploymentHost: "salle-de-sport-zasm-abc123.vercel.app",
      }),
    ).toBe("https://salle-de-sport-zasm-abc123.vercel.app");
  });

  it("ignore une adresse déclarée vide ou invalide et retombe sur localhost", () => {
    expect(resolveSiteUrl({ declared: "" })).toBe("http://localhost:3001");
    expect(resolveSiteUrl({ declared: "pas une adresse" })).toBe("http://localhost:3001");
  });
});
