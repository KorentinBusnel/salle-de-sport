/** Placement des séances d'une journée dans une grille horaire, avec colonnes pour les chevauchements. */
export type TimedItem = { id: string; startMinute: number; endMinute: number };
export type PlacedItem<T extends TimedItem> = T & { lane: number; lanes: number };

/**
 * Attribue à chaque séance une colonne (lane) : deux séances qui se chevauchent sont côte à
 * côte ; `lanes` est le nombre de colonnes du groupe de chevauchement, pour la largeur.
 */
export function layoutDay<T extends TimedItem>(items: readonly T[]): PlacedItem<T>[] {
  const sorted = [...items].sort(
    (a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute,
  );
  const placed: PlacedItem<T>[] = [];
  let group: PlacedItem<T>[] = [];
  let groupEnd = -Infinity;
  let laneEnds: number[] = [];

  const closeGroup = () => {
    const lanes = Math.max(1, laneEnds.length);
    for (const item of group) item.lanes = lanes;
    placed.push(...group);
    group = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (item.startMinute >= groupEnd) {
      closeGroup();
      groupEnd = -Infinity;
    }
    let lane = laneEnds.findIndex((end) => end <= item.startMinute);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMinute);
    } else {
      laneEnds[lane] = item.endMinute;
    }
    group.push({ ...item, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, item.endMinute);
  }
  closeGroup();
  return placed;
}

/** Consignes du glisser-déposer au clavier (lues avec chaque séance déplaçable). */
export const DND_INSTRUCTIONS_ID = "planning-dnd-instructions";
