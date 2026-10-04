import { Flash } from "@/components/flash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { isFrontDeskRole, isManagerRole, requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { activateMember, addCredits } from "./actions";

const STATUSES = ["prospect", "active", "suspended", "cancelled"] as const;
const LIMIT = 50;

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; ok?: string; erreur?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isFrontDeskRole);
  const manager = isManagerRole(context.role);
  const supabase = await createClient();

  const search = (params.q ?? "").trim().replace(/[%,()]/g, "");
  const status = STATUSES.find((s) => s === params.statut);

  let query = supabase
    .from("members")
    .select("id, first_name, last_name, email, phone, status")
    .eq("gym_id", context.gym.id)
    .order("last_name")
    .order("first_name")
    .limit(LIMIT);
  if (status) query = query.eq("status", status);
  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`,
    );
  }
  const { data: members } = await query;

  // Solde de crédits (gérant uniquement : la RLS réserve le registre aux finances).
  const balances = new Map<string, number>();
  if (manager && members?.length) {
    const { data: ledger } = await supabase
      .from("credit_ledger")
      .select("member_id, delta")
      .in(
        "member_id",
        members.map((m) => m.id),
      );
    for (const row of ledger ?? [])
      balances.set(row.member_id, (balances.get(row.member_id) ?? 0) + row.delta);
  }

  const returnQuery = new URLSearchParams(
    Object.entries({ q: params.q ?? "", statut: status ?? "" }).filter(([, v]) => v),
  ).toString();

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{t("members.title")}</h1>

      <form className="flex flex-wrap gap-2" role="search">
        <Input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder={t("members.searchPlaceholder")}
          aria-label={t("members.searchPlaceholder")}
          className="max-w-sm"
        />
        <NativeSelect
          name="statut"
          defaultValue={status ?? ""}
          aria-label={t("members.status")}
          className="w-48"
        >
          <option value="">{t("members.allStatuses")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`memberStatus.${s}`)}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">
          {t("common.search")}
        </Button>
      </form>

      <Flash ok={params.ok} error={params.erreur} />

      <Card>
        <CardContent className="overflow-x-auto pt-2">
          {(members ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("members.empty")}</p>
          ) : (
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 font-medium">{t("members.name")}</th>
                  <th className="py-2 font-medium">{t("members.contact")}</th>
                  <th className="py-2 font-medium">{t("members.status")}</th>
                  {manager ? (
                    <th className="py-2 text-right font-medium">{t("members.credits")}</th>
                  ) : null}
                  <th className="py-2 text-right font-medium">{t("members.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(members ?? []).map((member) => (
                  <tr key={member.id}>
                    <td className="py-2 font-medium">
                      {member.first_name} {member.last_name}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      <span className="block">{member.email ?? t("common.none")}</span>
                      <span className="block tabular-nums">{member.phone ?? ""}</span>
                    </td>
                    <td className="py-2">
                      <Badge variant={member.status === "active" ? "secondary" : "outline"}>
                        {t(`memberStatus.${member.status}`)}
                      </Badge>
                    </td>
                    {manager ? (
                      <td className="py-2 text-right tabular-nums">
                        {balances.get(member.id) ?? 0}
                      </td>
                    ) : null}
                    <td className="py-2">
                      <div className="flex justify-end gap-2">
                        {member.status === "prospect" || member.status === "suspended" ? (
                          <form action={activateMember}>
                            <input type="hidden" name="memberId" value={member.id} />
                            <input type="hidden" name="returnQuery" value={returnQuery} />
                            <Button size="sm">{t("members.activate")}</Button>
                          </form>
                        ) : null}
                        {manager ? (
                          <form action={addCredits} className="flex gap-1">
                            <input type="hidden" name="memberId" value={member.id} />
                            <input type="hidden" name="returnQuery" value={returnQuery} />
                            <Input
                              name="amount"
                              type="number"
                              min={1}
                              max={50}
                              defaultValue={10}
                              className="w-16"
                              aria-label={t("members.credits")}
                            />
                            <Button size="sm" variant="outline">
                              {t("members.addCredits")}
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {(members ?? []).length === LIMIT ? (
            <p className="pt-3 text-xs text-muted-foreground">
              {t("members.limited", { count: LIMIT })}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
