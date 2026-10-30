import { AssistantChat } from "@/components/assistant-chat";
import { t } from "@/lib/i18n";

const MEMBERS = [
  ["assistantDemo.member1", "assistantDemo.member1Last"],
  ["assistantDemo.member2", "assistantDemo.member2Last"],
  ["assistantDemo.member3", "assistantDemo.member3Last"],
] as const;

/**
 * Échange type avec l'assistant, dessiné en code (une capture demanderait une clé Anthropic) et
 * animé par `AssistantChat`. Noms fictifs, comme les données de démo.
 */
export function AssistantIllustration() {
  return (
    <AssistantChat
      text={{
        caption: t("assistantDemo.caption"),
        placeholder: t("assistantDemo.placeholder"),
        question: t("assistantDemo.question"),
        answer: t("assistantDemo.answer"),
        members: MEMBERS.map(([name, last]) => ({ name: t(name), last: t(last) })),
        proposal: t("assistantDemo.proposal"),
        proposalSubject: t("assistantDemo.proposalSubject"),
        edit: t("assistantDemo.edit"),
        validate: t("assistantDemo.validate"),
      }}
    />
  );
}
