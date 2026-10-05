"use client";

import { EllipsisIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { t } from "@/lib/i18n";

export type RowAction = {
  label: string;
  icon?: LucideIcon | undefined;
  /** Lien (navigation) ou action. */
  href?: string | undefined;
  onSelect?: (() => void) | undefined;
  destructive?: boolean | undefined;
  disabled?: boolean | undefined;
  /** Trait de séparation avant cette action. */
  separated?: boolean | undefined;
};

/** Menu « … » d'une ligne de tableau (Watermelon dropdown-menu-4). */
export function RowActionsMenu({ label, actions }: { label: string; actions: RowAction[] }) {
  if (!actions.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("forms.rowActions", { label })}
          className="text-muted-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground"
        >
          <EllipsisIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {actions.map((action, index) => {
          const Icon = action.icon;
          const content = (
            <>
              {Icon ? <Icon aria-hidden /> : null}
              {action.label}
            </>
          );
          return (
            <Fragment key={`${action.label}-${index}`}>
              {action.separated && index > 0 ? <DropdownMenuSeparator /> : null}
              {action.href ? (
                <DropdownMenuItem
                  asChild
                  disabled={action.disabled ?? false}
                  variant={action.destructive ? "destructive" : "default"}
                >
                  <Link href={action.href}>{content}</Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  disabled={action.disabled ?? false}
                  variant={action.destructive ? "destructive" : "default"}
                  onSelect={() => action.onSelect?.()}
                >
                  {content}
                </DropdownMenuItem>
              )}
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
