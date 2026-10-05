"use client";

import type { ComponentProps } from "react";
import { openAssistant } from "@/components/command-palette";
import { Button } from "@/components/ui/button";

/** Bouton qui ouvre l'assistant sur une demande préparée (la proposition reste à valider). */
export function AssistantButton({
  prompt,
  ...props
}: { prompt: string } & Omit<ComponentProps<typeof Button>, "onClick">) {
  return <Button {...props} onClick={() => openAssistant(prompt)} />;
}
