import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Polices des images générées (Open Graph, icônes, logo) : fichiers TTF du dépôt (OFL, voir
 * THIRD_PARTY_NOTICES.md), Satori ne lisant pas le woff2 de next/font.
 */
export async function ogFonts() {
  const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));
  const [fraunces, frauncesItalic, frauncesMedium, geist, geistSemibold] = await Promise.all([
    font("Fraunces-400.ttf"),
    font("Fraunces-400-Italic.ttf"),
    font("Fraunces-500.ttf"),
    font("Geist-400.ttf"),
    font("Geist-600.ttf"),
  ]);
  return [
    { name: "Fraunces", data: fraunces, weight: 400, style: "normal" },
    { name: "Fraunces", data: frauncesItalic, weight: 400, style: "italic" },
    { name: "Fraunces", data: frauncesMedium, weight: 500, style: "normal" },
    { name: "Geist", data: geist, weight: 400, style: "normal" },
    { name: "Geist", data: geistSemibold, weight: 600, style: "normal" },
  ] as const;
}
