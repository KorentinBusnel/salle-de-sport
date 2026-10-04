import { describe, expect, it } from "vitest";
import { layoutDay } from "./week-layout";

const item = (id: string, start: number, end: number) => ({
  id,
  startMinute: start,
  endMinute: end,
});

describe("layoutDay", () => {
  it("laisse une séance seule sur toute la largeur", () => {
    expect(layoutDay([item("a", 420, 480)])).toEqual([
      { ...item("a", 420, 480), lane: 0, lanes: 1 },
    ]);
  });

  it("place côte à côte deux séances simultanées", () => {
    const placed = layoutDay([item("crossfit", 735, 795), item("renfo", 735, 780)]);
    expect(placed.map((p) => [p.id, p.lane, p.lanes])).toEqual([
      ["renfo", 0, 2],
      ["crossfit", 1, 2],
    ]);
  });

  it("réutilise une colonne libérée et sépare les groupes sans chevauchement", () => {
    const placed = layoutDay([
      item("a", 600, 660),
      item("b", 630, 690),
      item("c", 660, 720),
      item("d", 900, 960),
    ]);
    expect(placed.map((p) => [p.id, p.lane, p.lanes])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 0, 2],
      ["d", 0, 1],
    ]);
  });
});
