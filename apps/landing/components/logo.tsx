import { brand } from "@/content/landing";

/** Logo typographique : nom en minuscules (Fraunces 500) et point en couleur d'action. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={`font-serif font-medium leading-none tracking-[-0.03em] lowercase ${className ?? ""}`}
    >
      {brand.wordmark}
      <span className="text-primary">.</span>
    </span>
  );
}
