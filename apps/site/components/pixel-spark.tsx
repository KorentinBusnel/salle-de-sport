import { cn } from "@/lib/cn";

// Éclat en pixels sur une grille de 12 × 12 pixels de 4 px, centre en (6, 6) laissé vide : rayons
// vers le haut, en haut à gauche, en haut à droite, à droite et en bas à droite, pour partir de
// l'angle haut droit d'une capture. Le pixel proche du centre est plus marqué que le bout.
const RAYS: [number, number][][] = [
  [
    [6, 3],
    [6, 2],
    [6, 1],
  ],
  [
    [3, 3],
    [2, 2],
  ],
  [
    [9, 3],
    [10, 2],
  ],
  [
    [9, 6],
    [10, 6],
    [11, 6],
  ],
  [
    [9, 9],
    [10, 10],
  ],
];

/** Petit éclat décoratif en pixels, posé sur l'angle d'une capture du produit (orange léger). */
export function PixelSpark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={cn("pointer-events-none text-primary", className)}
    >
      {RAYS.map((ray) => (
        <g key={ray.map(([x, y]) => `${x}-${y}`).join(" ")} fill="currentColor">
          {ray.map(([x, y], index) => (
            <rect
              key={`${x}-${y}`}
              x={x * 4}
              y={y * 4}
              width="4"
              height="4"
              opacity={index === 0 ? 0.6 : 0.35}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}
