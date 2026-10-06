import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Bloc de l'accueil : titre, lien vers l'écran complet, contenu. */
export function HomeSection({
  id,
  title,
  href,
  link,
  children,
}: {
  id: string;
  title: string;
  href: string;
  link: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        <Link href={href} className="text-sm font-medium text-primary hover:underline">
          {link}
        </Link>
      </div>
      {children}
    </section>
  );
}

/** Carte d'un bloc : titre, élément à droite (compteur, montant), contenu. */
export function HomeCard({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="font-semibold">{title}</CardTitle>
        {aside ? <CardAction>{aside}</CardAction> : null}
      </CardHeader>
      <CardContent className="grid gap-3">{children}</CardContent>
    </Card>
  );
}

/** Squelette d'un bloc, de la forme du bloc chargé. */
export function HomeSectionSkeleton({
  kpis = 0,
  cards = 2,
  list = false,
  className,
}: {
  kpis?: number | undefined;
  cards?: number | undefined;
  list?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <div className="grid gap-4" aria-busy="true">
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
      {kpis ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: kpis }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : null}
      <div className={cn("grid gap-4", className)}>
        {Array.from({ length: cards }, (_, i) => (
          <Skeleton key={i} className="h-56 rounded-xl" />
        ))}
      </div>
      {list ? <Skeleton className="h-72 rounded-xl" /> : null}
    </div>
  );
}
