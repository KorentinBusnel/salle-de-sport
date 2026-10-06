"use client";

import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeHref } from "@/lib/navigation";
import { usePageCrumb } from "@/components/page-crumb";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { t } from "@/lib/i18n";

export type Crumb = { href: string; label: string; group: string };

/**
 * Fil d'Ariane de la barre du haut : bloc de navigation, entrée, puis titre fourni par la page
 * (`PageCrumb`) sur une sous-page. Au téléphone, seul le retour vers l'entrée reste.
 */
export function AppBreadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  const pathname = usePathname();
  const page = usePageCrumb();
  const href = activeHref(
    pathname,
    crumbs.map((crumb) => crumb.href),
  );
  const current = crumbs.find((crumb) => crumb.href === href);
  if (!current) return null;
  const deeper = pathname !== current.href;
  const parentHref = page?.parentHref ?? current.href;

  return (
    <>
      {deeper ? (
        <Link
          href={parentHref}
          className="-ml-1 flex min-w-0 items-center gap-1 rounded-md px-1 text-sm font-medium sm:hidden pointer-coarse:h-10"
        >
          <ChevronLeftIcon aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{current.label}</span>
        </Link>
      ) : null}
      <Breadcrumb aria-label={t("topbar.breadcrumb")} className="hidden min-w-0 sm:block">
        <BreadcrumbList className="flex-nowrap">
          {current.group !== current.label ? (
            <>
              <BreadcrumbItem className="hidden lg:inline-flex">
                <span className="truncate">{current.group}</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden lg:inline-flex" />
            </>
          ) : null}
          <BreadcrumbItem className="min-w-0">
            {deeper ? (
              <BreadcrumbLink asChild>
                <Link href={parentHref} className="truncate">
                  {current.label}
                </Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage className="truncate">{current.label}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {deeper && page ? (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="max-w-64 truncate">{page.label}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : null}
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}
