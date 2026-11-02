import { cn } from "@/lib/utils";

/**
 * Marque du produit : un « C » tracé à la craie sur un carré orange (même dessin que app/icon.svg
 * et que la marque du site). `inverted` : carré blanc et « C » orange, pour un fond orange.
 */
export function BrandMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className={inverted ? "fill-white" : "fill-primary"} />
      <path
        d="M21.3 10.7a7.5 7.5 0 1 0 0 10.6"
        fill="none"
        strokeWidth="3.5"
        strokeLinecap="round"
        className={inverted ? "stroke-primary" : "stroke-white"}
      />
    </svg>
  );
}
