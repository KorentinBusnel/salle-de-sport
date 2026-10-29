import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline";
type Size = "main" | "small";

// Skill B1, B2, B9 : 8 px × 12 px, appui scale(0.98), couleur au survol en 300 ms.
const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-brand-700",
  secondary: "bg-secondary text-secondary-foreground hover:bg-neutral-200",
  outline: "bg-card text-foreground shadow-border hover:bg-background",
};
const SIZES: Record<Size, string> = {
  main: "rounded-lg text-base",
  small: "rounded-full text-sm",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "main"): string {
  return cn(
    "inline-flex min-h-10 items-center justify-center gap-2 px-3 py-2 font-semibold whitespace-nowrap",
    "transition-[background-color,scale] duration-300 ease-base active:scale-98",
    "disabled:pointer-events-none disabled:opacity-60",
    VARIANTS[variant],
    SIZES[size],
  );
}

export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  const classes = cn(buttonClasses(variant, size), className);
  // Ancre de la page : lien natif, pour que `hashchange` parte (le formulaire lit #contact) ;
  // next/link change l'adresse sans cet événement.
  if (href.startsWith("#")) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
