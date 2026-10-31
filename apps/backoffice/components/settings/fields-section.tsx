import { isChoiceField, LABEL_MAX, parseMemberField } from "@salle/shared";
import { ListChecksIcon } from "lucide-react";
import { FocusRow } from "@/components/inline/add-row";
import { EditableCell } from "@/components/inline/editable-cell";
import { FieldOptions } from "@/components/settings/field-options";
import { FieldOrder, FieldRowMenu } from "@/components/settings/field-order";
import { NewFieldDialog } from "@/components/settings/new-field-dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { createMemberField, updateMemberField } from "@/app/(app)/parametres/champs-actions";

/** `option_counts` (Json) → fiches par valeur d'option. */
function optionCounts(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );
}

/**
 * Champs personnalisés des fiches adhérent, « à la Notion » : libellé et interrupteurs
 * modifiables sur place, options en pastilles, ordre par « Monter / Descendre ». Le type ne
 * change pas après création (dialogue « Nouveau champ »).
 */
export async function FieldsSection({ gymId, fresh }: { gymId: string; fresh: string | null }) {
  const supabase = await createClient();
  const [{ data: rows }, { data: usage }] = await Promise.all([
    supabase
      .from("member_fields")
      .select("id, key, label, type, options, position, staff_can_edit, is_active")
      .eq("gym_id", gymId)
      .order("position")
      .order("label"),
    supabase.rpc("member_field_usage", { p_gym_id: gymId }),
  ]);
  const fields = (rows ?? []).flatMap((row) => {
    const field = parseMemberField(row);
    return field ? [field] : [];
  });
  const usageById = new Map((usage ?? []).map((row) => [row.field_id, row]));
  const ids = fields.map((field) => field.id);
  const freshId = fresh && ids.includes(fresh) ? fresh : null;
  const dash = <span className="px-2 text-muted-foreground">—</span>;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">{t("fields.hint")}</p>
        <NewFieldDialog action={createMemberField} />
      </div>

      {fields.length === 0 ? (
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListChecksIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{t("fields.title")}</EmptyTitle>
            <EmptyDescription>{t("fields.empty")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto px-2">
            {/* Tient dans la colonne des Paramètres (48 rem) : les interrupteurs restent visibles sans défilement. */}
            <Table className="min-w-[46rem]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">
                    <span className="sr-only">{t("fields.order")}</span>
                  </TableHead>
                  <TableHead className="w-44">{t("fields.label")}</TableHead>
                  <TableHead className="w-24">{t("fields.typeLabel")}</TableHead>
                  <TableHead className="min-w-48">{t("fields.options")}</TableHead>
                  <TableHead className="w-28 whitespace-normal">
                    {t("fields.staffCanEdit")}
                  </TableHead>
                  <TableHead className="w-16">{t("fields.active")}</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">{t("table.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const use = usageById.get(field.id);
                  return (
                    <TableRow
                      key={field.id}
                      data-row-id={field.id}
                      className={cn(
                        "hover:bg-transparent",
                        field.id === freshId && "bg-accent/40",
                        !field.is_active && "text-muted-foreground",
                      )}
                    >
                      <TableCell className="p-1">
                        <FieldOrder ids={ids} index={index} name={field.label} />
                      </TableCell>
                      <TableCell className="p-1 align-top">
                        <EditableCell
                          kind="text"
                          id={field.id}
                          field="label"
                          label={t("fields.label")}
                          value={field.label}
                          maxLength={LABEL_MAX}
                          action={updateMemberField}
                          className="font-medium"
                        />
                        <span className="block px-2 text-xs text-muted-foreground tabular-nums">
                          {t("fields.usage", { count: use?.values_count ?? 0 })}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2 align-top text-sm">
                        {t(`fields.type.${field.type}`)}
                      </TableCell>
                      <TableCell className="p-1 align-top">
                        {isChoiceField(field.type) ? (
                          <FieldOptions
                            id={field.id}
                            name={field.label}
                            options={field.options}
                            counts={optionCounts(use?.option_counts)}
                          />
                        ) : (
                          dash
                        )}
                      </TableCell>
                      <TableCell className="p-1 align-top">
                        <EditableCell
                          kind="switch"
                          id={field.id}
                          field="staff_can_edit"
                          label={`${t("fields.staffCanEdit")} : ${field.label}`}
                          value={field.staff_can_edit}
                          action={updateMemberField}
                        />
                      </TableCell>
                      <TableCell className="p-1 align-top">
                        <EditableCell
                          kind="switch"
                          id={field.id}
                          field="is_active"
                          label={`${t("fields.active")} : ${field.label}`}
                          value={field.is_active}
                          action={updateMemberField}
                        />
                      </TableCell>
                      <TableCell className="p-1 align-top">
                        <FieldRowMenu
                          id={field.id}
                          name={field.label}
                          valuesCount={use?.values_count ?? 0}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {freshId ? <FocusRow id={freshId} /> : null}
    </div>
  );
}
