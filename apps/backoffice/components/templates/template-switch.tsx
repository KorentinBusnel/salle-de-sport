"use client";

import { useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";

/** Interrupteur actif / inactif d'un cours récurrent : soumet la Server Action au changement. */
export function TemplateSwitch({
  id,
  active,
  label,
  action,
}: {
  id: string;
  active: boolean;
  label: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(!active)} />
      <Switch
        checked={active}
        onCheckedChange={() => form.current?.requestSubmit()}
        aria-label={t("templates.activeFor", { name: label })}
      />
      <span className="w-12 text-xs text-muted-foreground">
        {t(active ? "templates.active" : "templates.inactive")}
      </span>
    </form>
  );
}
