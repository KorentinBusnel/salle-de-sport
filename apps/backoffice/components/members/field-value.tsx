import {
  NUMBER_BOUNDS,
  optionLabel,
  type FieldValue as TypedValue,
  type MemberField,
} from "@salle/shared";
import { CheckIcon } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";

type FieldShape = Pick<MemberField, "type" | "options">;

/** Valeur Json lue en base, typée selon le champ ; `null` si absente ou d'un autre type. */
export function typedFieldValue(field: FieldShape, raw: unknown): TypedValue | null {
  switch (field.type) {
    case "text":
    case "date":
    case "select":
      return typeof raw === "string" ? raw : null;
    case "number":
      return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    case "boolean":
      return typeof raw === "boolean" ? raw : null;
    case "multi_select":
      return Array.isArray(raw)
        ? raw.filter((item): item is string => typeof item === "string")
        : null;
  }
}

const numberFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: NUMBER_BOUNDS.decimals,
});

/**
 * Valeur d'un champ personnalisé en lecture : pastille tonale pour une liste (une par choix),
 * coche pour « oui », date civile de la salle, nombre en chiffres tabulaires, « — » si absente.
 */
export function FieldValue({
  field,
  value,
  timeZone,
}: {
  field: FieldShape;
  value: unknown;
  timeZone: string;
}) {
  const typed = typedFieldValue(field, value);
  const dash = <span className="text-muted-foreground">{t("common.none")}</span>;
  if (typed === null) return dash;
  switch (field.type) {
    case "boolean":
      return typed === true ? (
        <span className="inline-flex items-center text-success">
          <CheckIcon aria-hidden className="size-4" />
          <span className="sr-only">{t("common.yes")}</span>
        </span>
      ) : (
        dash
      );
    case "select":
      return typeof typed === "string" ? (
        <StatusPill tone={field.options.find((o) => o.value === typed)?.tone ?? "neutral"}>
          {optionLabel(field, typed)}
        </StatusPill>
      ) : (
        dash
      );
    case "multi_select":
      return Array.isArray(typed) && typed.length ? (
        <span className="flex flex-wrap gap-1">
          {typed.map((item) => (
            <StatusPill
              key={item}
              tone={field.options.find((o) => o.value === item)?.tone ?? "neutral"}
            >
              {optionLabel(field, item)}
            </StatusPill>
          ))}
        </span>
      ) : (
        dash
      );
    case "date":
      return typeof typed === "string" ? (
        <span className="tabular-nums">{gymFormatters(timeZone).dateKey(typed)}</span>
      ) : (
        dash
      );
    case "number":
      return typeof typed === "number" ? (
        <span className="tabular-nums">{numberFormat.format(typed)}</span>
      ) : (
        dash
      );
    case "text":
      return typeof typed === "string" && typed !== "" ? (
        <span className="whitespace-pre-line">{typed}</span>
      ) : (
        dash
      );
  }
}
