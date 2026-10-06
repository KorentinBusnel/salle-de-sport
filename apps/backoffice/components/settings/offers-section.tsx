import { formatMoney } from "@salle/shared";
import { StripeSync } from "@/components/billing/stripe-sync";
import { AddRow } from "@/components/inline/add-row";
import { EditableCell } from "@/components/inline/editable-cell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  createPlan,
  createPromo,
  updatePlan,
  updatePromo,
} from "@/app/(app)/parametres/offres-actions";

const PLAN_TYPES = ["recurring", "pack", "single"] as const;

/**
 * Offres et codes promo « à la Notion » : chaque valeur se modifie sur place. Une offre se
 * désactive (elle reste dans l'historique des paiements) ; aucune discipline cochée : toutes.
 */
export async function OffersSection({ gymId }: { gymId: string }) {
  const supabase = await createClient();
  const [{ data: plans }, { data: disciplines }, { data: promos }, { data: uses }] =
    await Promise.all([
      supabase
        .from("plans")
        .select(
          "id, name, description, type, price_cents, billing_interval, commitment_months, credits, validity_days, audience, requires_proof, all_disciplines, is_active, stripe_price_id, plan_disciplines(discipline_id)",
        )
        .eq("gym_id", gymId)
        .order("position")
        .order("name"),
      supabase
        .from("disciplines")
        .select("id, name, color")
        .eq("gym_id", gymId)
        .order("position")
        .order("name"),
      supabase
        .from("promo_codes")
        .select(
          "id, code, kind, value, ends_on, max_redemptions, is_active, stripe_coupon_id, promo_code_plans(plan_id)",
        )
        .eq("gym_id", gymId)
        .order("code"),
      supabase
        .from("payments")
        .select("promo_code_id")
        .eq("gym_id", gymId)
        .not("promo_code_id", "is", null)
        .in("status", ["pending", "succeeded"]),
    ]);
  const disciplineOptions = (disciplines ?? []).map((d) => ({
    value: d.id,
    label: d.name,
    color: d.color,
  }));
  const planOptions = (plans ?? []).map((p) => ({ value: p.id, label: p.name }));
  const used = new Map<string, number>();
  for (const row of uses ?? [])
    if (row.promo_code_id) used.set(row.promo_code_id, (used.get(row.promo_code_id) ?? 0) + 1);
  const typeOptions = PLAN_TYPES.map((type) => ({ value: type, label: t(`offers.type.${type}`) }));
  const intervalOptions = (["month", "year"] as const).map((v) => ({
    value: v,
    label: t(`offers.interval.${v}`),
  }));
  const dash = <span className="px-2 text-muted-foreground">—</span>;

  return (
    <div className="grid gap-6">
      <p className="text-sm text-muted-foreground">{t("offers.hint")}</p>

      <Card>
        <CardHeader>
          <CardTitle>{t("offers.plans")}</CardTitle>
          <CardDescription>{t("offers.plansHint")}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-2">
          <Table className="min-w-[83rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-52">{t("offers.name")}</TableHead>
                <TableHead className="w-36">{t("offers.typeLabel")}</TableHead>
                <TableHead className="w-28">{t("offers.price")}</TableHead>
                <TableHead className="w-32">{t("offers.intervalLabel")}</TableHead>
                <TableHead className="w-32">{t("offers.commitment")}</TableHead>
                <TableHead className="w-28">{t("offers.credits")}</TableHead>
                <TableHead className="w-28">{t("offers.validity")}</TableHead>
                <TableHead className="w-40">{t("offers.audience")}</TableHead>
                <TableHead className="w-24">{t("offers.proof")}</TableHead>
                <TableHead className="w-48">{t("offers.disciplines")}</TableHead>
                <TableHead className="w-20">{t("offers.active")}</TableHead>
                <TableHead className="w-48">{t("offers.stripe")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(plans ?? []).map((p) => {
                const recurring = p.type === "recurring";
                return (
                  <TableRow key={p.id} data-row-id={p.id} className="hover:bg-transparent">
                    <TableCell className="p-1">
                      <EditableCell
                        kind="text"
                        id={p.id}
                        field="name"
                        label={t("offers.name")}
                        value={p.name}
                        maxLength={80}
                        action={updatePlan}
                        className="font-medium"
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        kind="select"
                        id={p.id}
                        field="type"
                        label={`${t("offers.typeLabel")} : ${p.name}`}
                        value={p.type}
                        options={typeOptions}
                        action={updatePlan}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        kind="number"
                        id={p.id}
                        field="price"
                        label={`${t("offers.price")} : ${p.name}`}
                        value={p.price_cents / 100}
                        min={0}
                        max={100000}
                        step={0.5}
                        decimals={2}
                        money
                        action={updatePlan}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      {recurring ? (
                        <EditableCell
                          kind="select"
                          id={p.id}
                          field="billing_interval"
                          label={`${t("offers.intervalLabel")} : ${p.name}`}
                          value={p.billing_interval}
                          options={intervalOptions}
                          action={updatePlan}
                        />
                      ) : (
                        dash
                      )}
                    </TableCell>
                    <TableCell className="p-1">
                      {recurring ? (
                        <EditableCell
                          kind="number"
                          id={p.id}
                          field="commitment_months"
                          label={`${t("offers.commitment")} : ${p.name}`}
                          value={p.commitment_months ?? 0}
                          unit={t("offers.months")}
                          min={0}
                          max={36}
                          zeroLabel={t("offers.none")}
                          action={updatePlan}
                        />
                      ) : (
                        dash
                      )}
                    </TableCell>
                    <TableCell className="p-1">
                      {recurring ? (
                        <span className="px-2 text-muted-foreground">{t("offers.unlimited")}</span>
                      ) : (
                        <EditableCell
                          kind="number"
                          id={p.id}
                          field="credits"
                          label={`${t("offers.credits")} : ${p.name}`}
                          value={p.credits ?? 1}
                          min={1}
                          max={500}
                          action={updatePlan}
                        />
                      )}
                    </TableCell>
                    <TableCell className="p-1">
                      {recurring ? (
                        dash
                      ) : (
                        <EditableCell
                          kind="number"
                          id={p.id}
                          field="validity_days"
                          label={`${t("offers.validity")} : ${p.name}`}
                          value={p.validity_days ?? 0}
                          unit={t("offers.days")}
                          min={0}
                          max={1095}
                          zeroLabel={t("offers.none")}
                          action={updatePlan}
                        />
                      )}
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        kind="text"
                        id={p.id}
                        field="audience"
                        label={`${t("offers.audience")} : ${p.name}`}
                        value={p.audience ?? ""}
                        emptyLabel={t("offers.everyone")}
                        maxLength={60}
                        action={updatePlan}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        kind="switch"
                        id={p.id}
                        field="requires_proof"
                        label={`${t("offers.proof")} : ${p.name}`}
                        value={p.requires_proof}
                        action={updatePlan}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        kind="multi"
                        id={p.id}
                        field="disciplines"
                        label={`${t("offers.disciplines")} : ${p.name}`}
                        value={
                          p.all_disciplines ? [] : p.plan_disciplines.map((d) => d.discipline_id)
                        }
                        options={disciplineOptions}
                        emptyLabel={t("offers.allDisciplines")}
                        action={updatePlan}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <EditableCell
                        kind="switch"
                        id={p.id}
                        field="is_active"
                        label={`${t("offers.active")} : ${p.name}`}
                        value={p.is_active}
                        action={updatePlan}
                      />
                    </TableCell>
                    <TableCell className="px-2">
                      <StripeSync
                        kind="plan"
                        id={p.id}
                        name={p.name}
                        synced={Boolean(p.stripe_price_id)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              <AddRow label={t("offers.newPlan")} action={createPlan} colSpan={12} />
            </TableBody>
          </Table>
          <p className="px-2 pt-3 text-xs text-muted-foreground">{t("offers.legend")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("offers.promos")}</CardTitle>
          <CardDescription>{t("offers.promosHint")}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-2">
          <Table className="min-w-[66rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">{t("offers.code")}</TableHead>
                <TableHead className="w-36">{t("offers.discountKind")}</TableHead>
                <TableHead className="w-28">{t("offers.discount")}</TableHead>
                <TableHead className="w-56">{t("offers.forPlans")}</TableHead>
                <TableHead className="w-40">{t("offers.endsOn")}</TableHead>
                <TableHead className="w-32">{t("offers.uses")}</TableHead>
                <TableHead className="w-20">{t("offers.active")}</TableHead>
                <TableHead className="w-48">{t("offers.stripe")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(promos ?? []).map((p) => (
                <TableRow key={p.id} data-row-id={p.id} className="hover:bg-transparent">
                  <TableCell className="p-1">
                    <EditableCell
                      kind="text"
                      id={p.id}
                      field="code"
                      label={t("offers.code")}
                      value={p.code}
                      maxLength={30}
                      action={updatePromo}
                      className="font-mono font-medium"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <EditableCell
                      kind="select"
                      id={p.id}
                      field="kind"
                      label={`${t("offers.discountKind")} : ${p.code}`}
                      value={p.kind}
                      options={[
                        { value: "percent", label: t("offers.kind.percent") },
                        { value: "amount", label: t("offers.kind.amount") },
                      ]}
                      action={updatePromo}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    {p.kind === "percent" ? (
                      <EditableCell
                        kind="number"
                        id={p.id}
                        field="value"
                        label={`${t("offers.discount")} : ${p.code}`}
                        value={p.value}
                        unit="%"
                        min={1}
                        max={100}
                        action={updatePromo}
                      />
                    ) : (
                      <EditableCell
                        kind="number"
                        id={p.id}
                        field="value"
                        label={`${t("offers.discount")} : ${p.code}`}
                        value={p.value / 100}
                        min={0.01}
                        max={100000}
                        decimals={2}
                        money
                        action={updatePromo}
                      />
                    )}
                  </TableCell>
                  <TableCell className="p-1">
                    <EditableCell
                      kind="multi"
                      id={p.id}
                      field="plans"
                      label={`${t("offers.forPlans")} : ${p.code}`}
                      value={p.promo_code_plans.map((x) => x.plan_id)}
                      options={planOptions}
                      emptyLabel={t("offers.allPlans")}
                      action={updatePromo}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <EditableCell
                      kind="date"
                      id={p.id}
                      field="ends_on"
                      label={`${t("offers.endsOn")} : ${p.code}`}
                      value={p.ends_on}
                      clearable
                      action={updatePromo}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <span className="flex items-center gap-1 tabular-nums">
                      <span className="pl-2 text-muted-foreground">{used.get(p.id) ?? 0} /</span>
                      <EditableCell
                        kind="number"
                        id={p.id}
                        field="max_redemptions"
                        label={`${t("offers.maxUses")} : ${p.code}`}
                        value={p.max_redemptions ?? 0}
                        min={0}
                        max={100000}
                        zeroLabel={t("offers.none")}
                        action={updatePromo}
                      />
                    </span>
                  </TableCell>
                  <TableCell className="p-1">
                    <EditableCell
                      kind="switch"
                      id={p.id}
                      field="is_active"
                      label={`${t("offers.active")} : ${p.code}`}
                      value={p.is_active}
                      action={updatePromo}
                    />
                  </TableCell>
                  <TableCell className="px-2">
                    <StripeSync
                      kind="promo"
                      id={p.id}
                      name={p.code}
                      synced={Boolean(p.stripe_coupon_id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
              <AddRow label={t("offers.newPromo")} action={createPromo} colSpan={8} />
            </TableBody>
          </Table>
          <p className="px-2 pt-3 text-xs text-muted-foreground">
            {t("offers.promosLegend", { example: formatMoney(1500) })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
