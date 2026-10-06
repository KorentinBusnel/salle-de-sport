import { describe, expect, it } from "vitest";
import { fr } from "@/messages/fr";

function entries(node: unknown, path = ""): [string, string][] {
  if (typeof node === "string") return [[path, node]];
  if (node && typeof node === "object")
    return Object.entries(node).flatMap(([key, value]) =>
      entries(value, path ? `${path}.${key}` : key),
    );
  return [];
}

/** Branches d'un pluriel ICU : leur texte, sans les accolades. */
function pluralBranches(message: string): string[] {
  const branches: string[] = [];
  for (const start of message.matchAll(/\{\w+, plural,/g)) {
    let index = (start.index ?? 0) + start[0].length;
    while (index < message.length) {
      const open = message.indexOf("{", index);
      const close = message.indexOf("}", index);
      // Fin du pluriel : l'accolade fermante arrive avant la prochaine branche.
      if (close !== -1 && (open === -1 || close < open)) break;
      const end = message.indexOf("}", open + 1);
      branches.push(message.slice(open + 1, end));
      index = end + 1;
    }
  }
  return branches;
}

describe("catalogue fr", () => {
  it("aucune variable dans une branche de pluriel (le traducteur ne les imbrique pas)", () => {
    const nested = entries(fr).filter(([, message]) =>
      pluralBranches(message).some((branch) => branch.includes("{")),
    );
    expect(nested.map(([key]) => key)).toEqual([]);
  });
});
