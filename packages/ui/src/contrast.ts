/**
 * Contrastes WCAG 2.x entre couleurs hexadécimales à 6 chiffres (`#rrggbb`). Utilisé par les
 * tests de tokens (back office, mobile, landing) pour garantir le niveau AA.
 */

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** Luminance relative WCAG 2.x. */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste (1 à 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Teinte « soft » : `color` posée à `alpha` sur `over` (ex. `bg-x/10` sur le fond). */
export function tint(color: string, over: string, alpha = 0.1): string {
  const fg = channels(color);
  const bg = channels(over);
  return `#${fg
    .map((c, i) => Math.round(c * alpha + (bg[i] ?? 0) * (1 - alpha)))
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}
