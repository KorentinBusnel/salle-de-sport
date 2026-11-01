import { describe, expect, it } from "vitest";
import { fr } from "@/messages/fr";
import { KEYWORD_ICON_NAMES, parseRichText, plainText } from "./rich-text";

function strings(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (node && typeof node === "object") return Object.values(node).flatMap(strings);
  return [];
}

describe("parseRichText", () => {
  it("découpe texte, pastilles et gras, ponctuation collée à la pastille", () => {
    expect(
      parseRichText("Demandez **« Qui ? »**. Les [adhérents](users), puis la [relance](mail)."),
    ).toEqual([
      { kind: "text", text: "Demandez " },
      { kind: "strong", text: "« Qui ? »" },
      { kind: "text", text: ". Les " },
      { kind: "keyword", text: "adhérents", icon: "users", after: "," },
      { kind: "text", text: " puis la " },
      { kind: "keyword", text: "relance", icon: "mail", after: "." },
    ]);
  });

  it("laisse une phrase sans balise intacte", () => {
    expect(parseRichText("Sans pastille.")).toEqual([{ kind: "text", text: "Sans pastille." }]);
  });

  it("rend le texte brut sans crochets ni astérisques", () => {
    expect(plainText("Vos [réservations](calendar), **vos** finances.")).toBe(
      "Vos réservations, vos finances.",
    );
  });
});

describe("pastilles du catalogue", () => {
  const tokens = strings(fr).flatMap((s) => [...s.matchAll(/\[([^\]]+)\]\(([^)]*)\)/g)]);

  it("n'utilisent que des icônes connues", () => {
    const unknown = tokens
      .map((m) => m[2] ?? "")
      .filter((name) => !(KEYWORD_ICON_NAMES as readonly string[]).includes(name));
    expect(unknown).toEqual([]);
  });

  it("restent à trois au plus par phrase", () => {
    const crowded = strings(fr).filter((s) => (s.match(/\]\([a-z]+\)/g) ?? []).length > 3);
    expect(crowded).toEqual([]);
  });
});
