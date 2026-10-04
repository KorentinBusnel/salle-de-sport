"use client";

import { useCallback, useRef, useState } from "react";
import type { AssistantEvent, Proposal } from "@/lib/ai/types";
import type { MessageKey } from "@/lib/i18n";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps: string[];
  proposals: Proposal[];
  pending?: boolean;
};

export type AssistantStatus = "idle" | "streaming" | "not_configured" | "error";

/**
 * Conversation avec l'assistant : envoie la question à /api/assistant et lit le flux NDJSON
 * (texte, étapes, propositions) pour mettre la réponse à jour au fil de l'eau.
 */
export function useAssistant({
  conversationId: initialId,
  initialMessages = [],
  memberId,
}: {
  conversationId?: string | undefined;
  initialMessages?: ChatMessage[];
  memberId?: string | undefined;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [status, setStatus] = useState<AssistantStatus>("idle");
  const [error, setError] = useState<MessageKey | null>(null);
  const conversation = useRef<string | undefined>(initialId);
  const [conversationId, setConversationId] = useState(initialId);

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || status === "streaming") return;
      const answerId = crypto.randomUUID();
      setError(null);
      setStatus("streaming");
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "user", text, steps: [], proposals: [] },
        { id: answerId, role: "assistant", text: "", steps: [], proposals: [], pending: true },
      ]);
      const patch = (update: (m: ChatMessage) => ChatMessage) =>
        setMessages((current) => current.map((m) => (m.id === answerId ? update(m) : m)));

      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message: text,
            ...(conversation.current ? { conversationId: conversation.current } : {}),
            ...(memberId ? { memberId } : {}),
          }),
        });
        if (response.status === 503) {
          setMessages((current) => current.filter((m) => m.id !== answerId));
          setStatus("not_configured");
          return;
        }
        if (!response.ok || !response.body) throw new Error(String(response.status));

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as AssistantEvent;
            if (event.type === "conversation") {
              conversation.current = event.id;
              setConversationId(event.id);
            } else if (event.type === "text") patch((m) => ({ ...m, text: m.text + event.delta }));
            else if (event.type === "step")
              patch((m) => ({ ...m, steps: [...m.steps, event.label] }));
            else if (event.type === "proposal")
              patch((m) => ({ ...m, proposals: [...m.proposals, event.proposal] }));
            else if (event.type === "error") setError(event.message as MessageKey);
          }
        }
        patch((m) => ({ ...m, pending: false }));
        setStatus("idle");
      } catch {
        patch((m) => ({ ...m, pending: false }));
        setError("assistant.errors.failed");
        setStatus("error");
      }
    },
    [memberId, status],
  );

  return { messages, status, error, ask, conversationId };
}
