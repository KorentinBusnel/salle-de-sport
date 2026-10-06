import { describe, expect, it } from "vitest";
import { robotsRules, SEARCH_BOTS, TRAINING_BOTS } from "./robots-rules";

const base = new URL("https://kettl.ai");

describe("robots.txt", () => {
  it("production : robots de recherche et d'entraînement autorisés, sitemap déclaré", () => {
    const robots = robotsRules(base, true);
    const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
    const allowed = rules.flatMap((rule) => [rule.userAgent ?? []].flat());
    for (const bot of [...SEARCH_BOTS, ...TRAINING_BOTS, "*"]) expect(allowed).toContain(bot);
    expect(rules.every((rule) => rule.allow === "/" && !rule.disallow)).toBe(true);
    expect(robots.sitemap).toBe("https://kettl.ai/sitemap.xml");
  });

  it("hors production : rien n'est indexé", () => {
    expect(robotsRules(base, false)).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("liste les robots nommés par le brief", () => {
    for (const bot of [
      "OAI-SearchBot",
      "ChatGPT-User",
      "PerplexityBot",
      "Claude-SearchBot",
      "Claude-User",
      "Googlebot",
      "Bingbot",
    ]) {
      expect(SEARCH_BOTS).toContain(bot);
    }
    for (const bot of ["GPTBot", "ClaudeBot", "Google-Extended"])
      expect(TRAINING_BOTS).toContain(bot);
  });
});
