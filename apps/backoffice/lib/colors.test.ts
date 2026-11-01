import { categoryPalette } from "@salle/ui";
import { describe, expect, it } from "vitest";
import { coachColors } from "./colors";

describe("coachColors", () => {
  it("une couleur par coach, dans l'ordre de la liste, puis la palette recommence", () => {
    const ids = Array.from({ length: categoryPalette.length + 2 }, (_, i) => `coach-${i}`);
    const colors = coachColors(ids);
    expect(colors.get("coach-0")).toBe(categoryPalette[0]);
    expect(colors.get("coach-1")).toBe(categoryPalette[1]);
    expect(new Set(ids.slice(0, categoryPalette.length).map((id) => colors.get(id))).size).toBe(
      categoryPalette.length,
    );
    expect(colors.get(`coach-${categoryPalette.length}`)).toBe(categoryPalette[0]);
  });
});
