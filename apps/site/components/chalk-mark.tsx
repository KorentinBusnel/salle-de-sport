import { cn } from "@/lib/cn";

/** Marque du produit : un « C » tracé à la craie sur un carré orange. Même dessin que app/icon.svg. */
export function ChalkMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M21.3 10.7a7.5 7.5 0 1 0 0 10.6"
        fill="none"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
