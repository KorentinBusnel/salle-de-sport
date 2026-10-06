"use client";

import { CopyIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { duplicateTemplate } from "@/app/(app)/planning/modeles/actions";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { t } from "@/lib/i18n";

/** Menu « … » d'un cours récurrent : Dupliquer (copie inactive, qui prend le focus). */
export function TemplateActions({ id, label }: { id: string; label: string }) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <RowActionsMenu
      label={label}
      actions={[
        {
          label: t("templates.duplicate"),
          icon: CopyIcon,
          onSelect: () =>
            startTransition(async () => {
              const result = await duplicateTemplate({ id });
              if (result.error) {
                toast.error(t(result.error), { closeButton: true });
                return;
              }
              toast.success(t("templates.duplicated"));
              if (result.id) router.replace(`${pathname}?n=${result.id}`, { scroll: false });
            }),
        },
      ]}
    />
  );
}
