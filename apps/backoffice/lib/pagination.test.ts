import { describe, expect, it } from "vitest";
import { pageSizeOf, pageWindow } from "./pagination";

describe("pagination", () => {
  it("fenêtre autour de la page courante, avec coupures", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 4)).toEqual([1, 2, 3, 4]);
    expect(pageWindow(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
    expect(pageWindow(10, 10)).toEqual([1, "gap", 9, 10]);
  });

  it("une coupure d'une seule page montre la page", () => {
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("taille de page : 25, 50 ou 100", () => {
    expect(pageSizeOf("50")).toBe(50);
    expect(pageSizeOf("40")).toBe(25);
    expect(pageSizeOf(undefined)).toBe(25);
  });
});
