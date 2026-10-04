import { CAPACITY, DURATION } from "@salle/shared";
import type { Metadata } from "next";
import { AddRow } from "@/components/inline/add-row";
import { EditableCell } from "@/components/inline/editable-cell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isManagerRole, requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { createDiscipline, createRoom, updateDiscipline, updateRoom } from "./actions";

export const metadata: Metadata = { title: t("catalog.title") };

/** Catalogue « à la Notion » : disciplines et salles éditables cellule par cellule. */
export default async function CatalogPage() {
  const context = await requireRole(isManagerRole);
  const supabase = await createClient();
  const [{ data: disciplines }, { data: rooms }] = await Promise.all([
    supabase
      .from("disciplines")
      .select("id, name, color, description, default_duration_minutes, default_capacity, is_active")
      .eq("gym_id", context.gym.id)
      .order("name"),
    supabase.from("rooms").select("id, name, capacity").eq("gym_id", context.gym.id).order("name"),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader title={t("catalog.title")} description={t("catalog.hint")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("catalog.disciplines")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-2">
          <Table className="min-w-[48rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">{t("catalog.name")}</TableHead>
                <TableHead className="w-36">{t("catalog.color")}</TableHead>
                <TableHead>{t("catalog.description")}</TableHead>
                <TableHead className="w-32">{t("catalog.defaultDuration")}</TableHead>
                <TableHead className="w-32">{t("catalog.defaultCapacity")}</TableHead>
                <TableHead className="w-20">{t("catalog.active")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(disciplines ?? []).map((d) => (
                <TableRow key={d.id} className="hover:bg-transparent">
                  <TableCell className="p-1">
                    <EditableCell
                      kind="text"
                      id={d.id}
                      field="name"
                      label={t("catalog.name")}
                      value={d.name}
                      maxLength={60}
                      action={updateDiscipline}
                      className="font-medium"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <EditableCell
                      kind="color"
                      id={d.id}
                      field="color"
                      label={t("catalog.color")}
                      value={d.color}
                      action={updateDiscipline}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <EditableCell
                      kind="text"
                      id={d.id}
                      field="description"
                      label={t("catalog.description")}
                      value={d.description ?? ""}
                      maxLength={300}
                      action={updateDiscipline}
                      className="text-muted-foreground"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <EditableCell
                      kind="number"
                      id={d.id}
                      field="default_duration_minutes"
                      label={t("catalog.defaultDuration")}
                      value={d.default_duration_minutes}
                      unit={t("catalog.minutes")}
                      min={DURATION.min}
                      max={DURATION.max}
                      step={DURATION.step}
                      action={updateDiscipline}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <EditableCell
                      kind="number"
                      id={d.id}
                      field="default_capacity"
                      label={t("catalog.defaultCapacity")}
                      value={d.default_capacity}
                      unit={t("catalog.places")}
                      min={CAPACITY.min}
                      max={CAPACITY.max}
                      action={updateDiscipline}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <EditableCell
                      kind="switch"
                      id={d.id}
                      field="is_active"
                      label={`${t("catalog.active")} : ${d.name}`}
                      value={d.is_active}
                      action={updateDiscipline}
                    />
                  </TableCell>
                </TableRow>
              ))}
              <AddRow label={t("catalog.newDiscipline")} action={createDiscipline} colSpan={6} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>{t("catalog.rooms")}</CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("catalog.name")}</TableHead>
                <TableHead className="w-36">{t("catalog.capacity")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rooms ?? []).map((r) => (
                <TableRow key={r.id} className="hover:bg-transparent">
                  <TableCell className="p-1">
                    <EditableCell
                      kind="text"
                      id={r.id}
                      field="name"
                      label={t("catalog.name")}
                      value={r.name}
                      maxLength={60}
                      action={updateRoom}
                      className="font-medium"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <EditableCell
                      kind="number"
                      id={r.id}
                      field="capacity"
                      label={t("catalog.capacity")}
                      value={r.capacity}
                      unit={t("catalog.places")}
                      min={CAPACITY.min}
                      max={CAPACITY.max}
                      action={updateRoom}
                    />
                  </TableCell>
                </TableRow>
              ))}
              <AddRow label={t("catalog.newRoom")} action={createRoom} colSpan={2} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
