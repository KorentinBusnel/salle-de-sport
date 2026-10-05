"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeHref } from "@/components/app-sidebar";
import { t } from "@/lib/i18n";

export type Crumb = { href: string; label: string; group: string };

/** Fil d'Ariane de la barre du haut : bloc de navigation puis page (lien sur une sous-page). */
export function AppBreadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  const pathname = usePathname();
  const href = activeHref(
    pathname,
    crumbs.map((crumb) => crumb.href),
  );
  const current = crumbs.find((crumb) => crumb.href === href);
  if (!current) return null;
  const deeper = pathname !== current.href;
  return (
    <nav
      aria-label={t("topbar.breadcrumb")}
      className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex"
    >
      {current.group !== current.label ? (
        <>
          <span className="truncate text-muted-foreground">{current.group}</span>
          <span aria-hidden className="text-muted-foreground">
            /
          </span>
        </>
      ) : null}
      {deeper ? (
        <Link href={current.href} className="truncate font-medium hover:underline">
          {current.label}
        </Link>
      ) : (
        <span aria-current="page" className="truncate font-medium">
          {current.label}
        </span>
      )}
    </nav>
  );
}
