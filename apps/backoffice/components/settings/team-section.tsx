import { XIcon } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { TeamContext } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { addTeamRole, removeTeamRole } from "@/app/(app)/parametres/actions";

/** Équipe : comptes ayant accès au back office et leurs rôles. */
export async function TeamSection({ context }: { context: TeamContext }) {
  const supabase = await createClient();
  const { data: team } = await supabase.rpc("team_members", { p_gym_id: context.gym.id });
  const isAdmin = context.role === "admin";
  const assignable: ("staff" | "coach" | "manager" | "admin")[] = isAdmin
    ? ["staff", "coach", "manager", "admin"]
    : ["staff", "coach", "manager"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("team.title")}</CardTitle>
        <CardDescription>{t("team.hint")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <ul className="divide-y rounded-lg border">
          {(team ?? []).map((member) => (
            <li key={member.profile_id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <span className="grid min-w-0 flex-1 text-sm">
                <span className="truncate font-medium">
                  {[member.first_name, member.last_name].filter(Boolean).join(" ") || member.email}
                </span>
                <span className="truncate text-xs text-muted-foreground">{member.email}</span>
              </span>
              <span className="flex flex-wrap gap-1">
                {member.roles.map((role) => {
                  const locked =
                    (member.profile_id === context.userId &&
                      (role === "manager" || role === "admin")) ||
                    (role === "admin" && !isAdmin);
                  return (
                    <span
                      key={role}
                      className="flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-xs"
                    >
                      {t(`roles.${role}`)}
                      {locked ? (
                        <span className="w-1" />
                      ) : (
                        <form action={removeTeamRole}>
                          <input type="hidden" name="profileId" value={member.profile_id} />
                          <input type="hidden" name="role" value={role} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t("team.remove", { role: t(`roles.${role}`) })}
                          >
                            <XIcon />
                          </Button>
                        </form>
                      )}
                    </span>
                  );
                })}
              </span>
            </li>
          ))}
        </ul>
        <form action={addTeamRole} className="flex flex-wrap items-end gap-2">
          <label className="grid flex-1 gap-1 text-sm">
            <span className="text-muted-foreground">{t("team.email")}</span>
            <Input name="email" type="email" required placeholder="prenom@exemple.fr" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t("team.role")}</span>
            <NativeSelect name="role" defaultValue="staff">
              {assignable.map((role) => (
                <NativeSelectOption key={role} value={role}>
                  {t(`roles.${role}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <SubmitButton variant="outline">{t("team.add")}</SubmitButton>
        </form>
        <p className="text-xs text-muted-foreground">{t("team.inviteLater")}</p>
      </CardContent>
    </Card>
  );
}
