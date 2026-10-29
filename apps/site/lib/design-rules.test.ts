import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Garde-fous du skill landing-page-design (.claude/skills) sur les classes Tailwind du site.
const ROOT = fileURLToPath(new URL("..", import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

const FILES = ["app", "components", "lib"].flatMap((dir) => sources(join(ROOT, dir)));

/** Classes d'un fichier, sans leurs variantes (`sm:`, `hover:`…). */
function utilities(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/[\w:.[\]/!-]+/g)].map((match) => match[0].split(":").at(-1) ?? "");
}

function offenders(test: (utility: string) => boolean) {
  return FILES.flatMap((file) =>
    utilities(file)
      .filter(test)
      .map((utility) => `${relative(ROOT, file)} : ${utility}`),
  );
}

// B2 : 0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96 px.
const SPACING = new Set(["0", "0.5", "1", "2", "3", "4", "6", "8", "10", "12", "16", "20", "24"]);
const SPACING_UTILITY = /^-?(p[xytrblse]?|m[xytrblse]?|gap(-[xy])?|space-[xy])-(.+)$/;

describe("règles visuelles du site", () => {
  it("espacements de la table B2 seulement", () => {
    expect(
      offenders((utility) => {
        const value = SPACING_UTILITY.exec(utility)?.[3];
        return value !== undefined && value !== "auto" && !SPACING.has(value);
      }),
    ).toEqual([]);
  });

  it("aucune valeur arbitraire de texte, de rayon ou d'espacement (B1, B3)", () => {
    expect(
      offenders((utility) =>
        /^-?(text|leading|font|rounded(-\w+)?|p[xytrblse]?|m[xytrblse]?|gap(-[xy])?)-\[/.test(
          utility,
        ),
      ),
    ).toEqual([]);
  });

  it("ni italique, ni graisse 800 ou 900, ni dégradé de fond (B1, B4)", () => {
    expect(
      offenders((utility) =>
        /^(italic|font-black|font-extrabold|bg-(gradient|linear|radial|conic)(-.*)?)$/.test(
          utility,
        ),
      ),
    ).toEqual([]);
  });

  it("courbe ease-base, jamais transition-all ni durée sous 200 ms (B7)", () => {
    expect(
      offenders((utility) =>
        /^(transition-all|ease-(in|out|in-out|linear)|duration-(0|75|100|150))$/.test(utility),
      ),
    ).toEqual([]);
  });

  it("icônes Phosphor seulement (B6)", () => {
    const foreign = FILES.filter((file) =>
      /from "(lucide-react|@mui\/icons-material|react-icons[^"]*)"/.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(foreign).toEqual([]);
  });
});
