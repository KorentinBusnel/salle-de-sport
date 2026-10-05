import "server-only";
import { type DailyDigest, digestInputSchema } from "@salle/shared";
import { defineTool, type AgentTool } from "@/lib/ai/agent";
import { anthropicTurn } from "@/lib/ai/client";
import { askAssistant } from "@/lib/ai/run";
import { assistantTools, type ToolContext } from "@/lib/ai/tools";
import type { TeamContext } from "@/lib/auth";
import { t } from "@/lib/i18n";

/** Consigne de la synthèse quotidienne (brief + actions par catégorie). */
const DIGEST_INSTRUCTIONS = [
  "Mission : préparer la synthèse du jour du gérant. Lis la journée (get_today_board), les impayés (get_unpaid), le CRM à compléter (get_crm_todo), le planning du jour et de demain (list_sessions) et les adhérents à risque (get_churn_list).",
  "Puis appelle UNE fois submit_digest :",
  "- brief : une ou deux phrases à l'impératif, chacune sur une action faisable aujourd'hui, avec au plus deux boutons (label court, prompt = la demande à te reposer pour préparer l'action).",
  "- categories : exactement operations, clients et finance. summary = une phrase tournée vers l'action. items = au plus 4 actions concrètes par catégorie, les plus utiles d'abord ; une catégorie sans action dit simplement que tout est en ordre.",
  "- chaque item : id court unique (ex. ops-1), source parmi bookings, payments, crm, messages (les autres sources ne sont pas encore connectées), from = de qui ou de quoi il s'agit, read = le fait constaté en une phrase, action = ce qu'il faut faire, cta = libellé du bouton (2 ou 3 mots), prompt = la demande qui te fera préparer l'action (par exemple un message à valider), memberId si un adhérent est concerné.",
  "N'invente rien : chaque item s'appuie sur un résultat d'outil. Ne mentionne jamais le contenu d'une note « à savoir ».",
].join("\n");

/**
 * Génère le digest du jour : l'assistant lit les données de la salle (sous la RLS du gérant) et
 * rend sa synthèse par l'outil `submit_digest`, validée par `digestInputSchema`.
 */
export async function generateDailyDigest(
  context: TeamContext,
): Promise<{ digest: Omit<DailyDigest, "dismissed"> } | { error: "notConfigured" | "failed" }> {
  const ai = anthropicTurn();
  if (!ai) return { error: "notConfigured" };

  let submitted: Omit<DailyDigest, "dismissed"> | null = null;
  const submit = defineTool<ToolContext, typeof digestInputSchema>({
    name: "submit_digest",
    description:
      "Enregistre la synthèse du jour (brief + actions par catégorie). À appeler une seule fois, à la fin.",
    schema: digestInputSchema,
    step: t("assistant.steps.digest"),
    async run(_ctx, input) {
      submitted = input;
      return { saved: true };
    },
  });
  const readOnly: AgentTool<ToolContext>[] = assistantTools.filter((tool) => !tool.proposes);

  await askAssistant({
    context,
    turn: ai.turn,
    model: ai.model,
    history: [],
    question: "Prépare la synthèse du jour.",
    tools: [...readOnly, submit],
    instructions: DIGEST_INSTRUCTIONS,
    emit: () => {},
  });
  return submitted ? { digest: submitted } : { error: "failed" };
}
