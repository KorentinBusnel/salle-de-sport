"use client";

import * as React from "react";
import { cn } from "cn";

/**
 * Tableau dans un conteneur défilant. `containerClassName` (ex. `max-h-[70vh]`) et
 * `containerLabel` rendent le conteneur atteignable au clavier quand il défile ; en-tête et
 * pied collants avec `sticky` sur TableHeader / TableFooter, première colonne avec
 * `TableCell sticky`.
 */
function Table({
  className,
  containerClassName,
  containerLabel,
  ...props
}: React.ComponentProps<"table"> & {
  containerClassName?: string | undefined;
  containerLabel?: string | undefined;
}) {
  return (
    <div
      data-slot="table-container"
      className={cn("relative w-full overflow-x-auto", containerClassName)}
      {...(containerLabel ? { tabIndex: 0, role: "region", "aria-label": containerLabel } : {})}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({
  className,
  sticky,
  ...props
}: React.ComponentProps<"thead"> & { sticky?: boolean | undefined }) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "[&_tr]:border-b",
        sticky && "sticky top-0 z-20 bg-card shadow-[inset_0_-1px_0_var(--border)]",
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({
  className,
  sticky,
  ...props
}: React.ComponentProps<"tfoot"> & { sticky?: boolean | undefined }) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        sticky && "sticky bottom-0 z-20 bg-muted shadow-[inset_0_1px_0_var(--border)]",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "group/row border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-accent",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({
  className,
  sticky,
  ...props
}: React.ComponentProps<"th"> & { sticky?: boolean | undefined }) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        sticky && "sticky left-0 z-30 bg-card",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({
  className,
  sticky,
  ...props
}: React.ComponentProps<"td"> & { sticky?: boolean | undefined }) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        // Colonne collante (nom) : fond opaque, y compris au survol et en sélection.
        sticky &&
          "sticky left-0 z-10 bg-card group-hover/row:bg-muted group-data-[state=selected]/row:bg-accent",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
