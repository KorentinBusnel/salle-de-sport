#!/usr/bin/env node
// Vérifie que chaque variable d'environnement lue par le code est documentée dans .env.example
// (BRIEF §10.5). Cherche process.env.X et Deno.env.get("X") dans apps/, packages/, supabase/.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const SCANNED = ["apps", "packages", "supabase/functions"];
const IGNORED_DIRS = new Set(["node_modules", ".next", ".expo", "dist", ".turbo", "coverage"]);
const EXTENSIONS = /\.(ts|tsx|js|mjs|cjs)$/;
// Variables fournies par l'outillage, pas par la configuration du projet.
const BUILTIN = new Set(["NODE_ENV", "CI"]);

const documented = new Set(
  readFileSync(join(root, ".env.example"), "utf8")
    .split("\n")
    .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
    .filter(Boolean),
);

function* files(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (EXTENSIONS.test(entry)) yield path;
  }
}

const missing = new Map();
for (const dir of SCANNED) {
  for (const file of files(join(root, dir))) {
    const source = readFileSync(file, "utf8");
    const pattern =
      /process\.env\.([A-Z][A-Z0-9_]*)|Deno\.env\.get\(\s*["']([A-Z][A-Z0-9_]*)["']\s*\)/g;
    for (const match of source.matchAll(pattern)) {
      const name = match[1] ?? match[2];
      if (!BUILTIN.has(name) && !documented.has(name)) {
        missing.set(name, [...(missing.get(name) ?? []), relative(root, file)]);
      }
    }
  }
}

if (missing.size > 0) {
  console.error("Variables lues par le code mais absentes de .env.example :");
  for (const [name, where] of missing)
    console.error(`  ${name}  (${[...new Set(where)].join(", ")})`);
  process.exit(1);
}
console.log(`.env.example à jour (${documented.size} variables documentées).`);
