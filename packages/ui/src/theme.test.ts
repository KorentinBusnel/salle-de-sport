import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { colors, disciplineColors, radius } from "./tokens.ts";

const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

function cssVars(): Map<string, string> {
  const vars = new Map<string, string>();
  for (const match of css.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    vars.set(match[1] ?? "", (match[2] ?? "").trim());
  }
  return vars;
}

function expectedVars(): Map<string, string> {
  const expected = new Map<string, string>();
  for (const [name, value] of Object.entries(colors)) {
    if (typeof value === "string") {
      expected.set(`--color-${name}`, value);
    } else {
      for (const [shade, hex] of Object.entries(value))
        expected.set(`--color-${name}-${shade}`, hex);
    }
  }
  for (const [name, hex] of Object.entries(disciplineColors)) {
    expected.set(`--color-discipline-${name}`, hex);
  }
  for (const [name, px] of Object.entries(radius)) {
    if (name !== "full") expected.set(`--radius-${name}`, `${px}px`);
  }
  return expected;
}

describe("theme.css", () => {
  it("reprend exactement les tokens de tokens.ts", () => {
    expect(cssVars()).toEqual(expectedVars());
  });
});
