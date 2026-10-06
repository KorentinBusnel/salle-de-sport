/**
 * Vérifie le HTML prérendu par `next build` (LANDING_BRIEF.md §8) : texte de toutes les vues de
 * l'aperçu et de la FAQ présent sans JavaScript, JSON-LD lisible et conforme à la FAQ affichée,
 * robots.txt, sitemap.xml et llms.txt produits. Lancé en CI après le build : `pnpm check:html`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { faq, finalCta, hero, preview } from "../content/landing.ts";

const app = join(import.meta.dirname, "..", ".next", "server", "app");
const failures: string[] = [];

function read(file: string): string {
  const path = join(app, file);
  if (!existsSync(path)) {
    failures.push(`${file} absent : lancer « pnpm build » avant ce contrôle`);
    return "";
  }
  return readFileSync(path, "utf8");
}

function decode(text: string): string {
  return text
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Textes affichés d'un objet de contenu (identifiants et tons exclus). */
function strings(value: unknown, key = ""): string[] {
  if (["id", "tone"].includes(key)) return [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap((item) => strings(item));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => strings(v, k));
  }
  return [];
}

const html = read("index.html");
const text = decode(
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<!-- -->/g, "")
    .replace(/<[^>]+>/g, " "),
).replace(/\s+/g, " ");

const expected = [
  ...strings(preview),
  ...strings(faq),
  ...strings(finalCta),
  hero.badge,
  hero.subtitle,
  hero.title.emphasis,
];
for (const snippet of new Set(expected)) {
  if (!text.includes(snippet.replace(/\s+/g, " ")))
    failures.push(`texte absent du HTML : « ${snippet} »`);
}
if ((html.match(/<h1[\s>]/g) ?? []).length !== 1) failures.push("la page doit avoir un seul <h1>");
if (!html.includes('<html lang="fr"')) failures.push('attribut lang="fr" absent');

const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
if (!jsonLd) {
  failures.push("JSON-LD absent");
} else {
  const graph = (JSON.parse(jsonLd) as { "@graph": { "@type": string; mainEntity?: unknown }[] })[
    "@graph"
  ];
  const types = graph.map((node) => node["@type"]).join(",");
  if (types !== "Organization,WebSite,SoftwareApplication,FAQPage") {
    failures.push(`JSON-LD : types inattendus (${types})`);
  }
  const questions = (graph.find((node) => node["@type"] === "FAQPage")?.mainEntity ?? []) as {
    name: string;
  }[];
  if (questions.map((q) => q.name).join("|") !== faq.items.map((q) => q.question).join("|")) {
    failures.push("JSON-LD : FAQPage différente de la FAQ affichée");
  }
}

if (!read("robots.txt.body").includes("User-Agent")) failures.push("robots.txt vide");
if (!read("sitemap.xml.body").includes("<urlset")) failures.push("sitemap.xml invalide");
if (!read("llms.txt.body").startsWith("# ")) failures.push("llms.txt invalide");

if (failures.length > 0) {
  console.error(`Contrôle du HTML prérendu : ${failures.length} problème(s)`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  `HTML prérendu conforme (${new Set(expected).size} textes vérifiés, JSON-LD, robots, sitemap, llms.txt).`,
);
