"use client";

import { ArrowUpIcon, SparkleIcon } from "@phosphor-icons/react/ssr";
import { Fragment, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type AssistantChatText = {
  caption: string;
  placeholder: string;
  question: string;
  answer: string;
  members: { name: string; last: string }[];
  proposal: string;
  proposalSubject: string;
  edit: string;
  validate: string;
};

type Stage = {
  focus: boolean;
  typed: number;
  sent: boolean;
  thinking: boolean;
  words: number;
  rows: number;
  proposal: boolean;
};

const IDLE: Stage = {
  focus: false,
  typed: 0,
  sent: false,
  thinking: false,
  words: 0,
  rows: 0,
  proposal: false,
};

/** Étapes de l'échange, en millisecondes depuis le début : frappe, envoi, réflexion, réponse. */
function timeline(question: string, words: number, rows: number) {
  const events: [number, Partial<Stage>][] = [[0, { focus: true }]];
  let at = 400;
  for (let typed = 1; typed <= question.length; typed++) {
    at += question[typed - 1] === " " ? 90 : 45;
    events.push([at, { typed }]);
  }
  at += 500;
  events.push([at, { focus: false, typed: 0, sent: true }]);
  at += 400;
  events.push([at, { thinking: true }]);
  at += 1000;
  events.push([at, { thinking: false, words: 1 }]);
  for (let word = 2; word <= words; word++) {
    at += 60;
    events.push([at, { words: word }]);
  }
  for (let row = 1; row <= rows; row++) {
    at += 160;
    events.push([at, { rows: row }]);
  }
  at += 300;
  events.push([at, { proposal: true }]);
  return events;
}

const on = (shown: boolean) => (shown ? "" : undefined);

/**
 * Échange avec l'assistant, joué une fois quand il arrive à l'écran : la question se tape dans le
 * champ, part, l'assistant réfléchit puis répond mot à mot, comme en direct. Tout le texte est dans
 * le DOM dès le départ (place réservée, lecteurs d'écran) ; sans JavaScript, l'échange s'affiche
 * fini, et avec la réduction des animations il apparaît d'un coup. Styles : `[data-chat]` dans
 * globals.css.
 */
export function AssistantChat({ text }: { text: AssistantChatText }) {
  const words = text.answer.split(" ");
  const [stage, setStage] = useState<Stage>(IDLE);
  const root = useRef<HTMLElement>(null);
  const field = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const timers: number[] = [];
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const finished = {
          sent: true,
          words: words.length,
          rows: text.members.length,
          proposal: true,
        };
        const events: [number, Partial<Stage>][] = matchMedia("(prefers-reduced-motion: reduce)")
          .matches
          ? [[0, finished]]
          : timeline(text.question, words.length, text.members.length);
        for (const [at, change] of events) {
          timers.push(
            window.setTimeout(() => setStage((current) => ({ ...current, ...change })), at),
          );
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [text.question, text.members.length, words.length]);

  // Comme un vrai champ : la fin de la saisie reste visible.
  useEffect(() => {
    const element = field.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [stage.typed]);

  return (
    <figure ref={root} className="rounded-2xl bg-neutral-100 p-2 shadow-border">
      <figcaption className="sr-only">{text.caption}</figcaption>
      <div className="space-y-4 rounded-lg bg-card p-4 sm:p-6">
        <p
          data-chat=""
          data-on={on(stage.sent)}
          className="ml-auto w-fit max-w-xs rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          {text.question}
        </p>
        <div className="flex gap-3">
          <span
            data-chat=""
            data-on={on(stage.thinking || stage.words > 0)}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary"
          >
            <SparkleIcon aria-hidden="true" className="size-4" />
          </span>
          <div className="relative min-w-0 flex-1 space-y-3 text-sm">
            {stage.thinking ? (
              <span
                aria-hidden="true"
                className="absolute top-0 left-0 flex h-5 items-center gap-1"
              >
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="size-1.5 animate-dot rounded-full bg-muted-foreground"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            ) : null}
            <p>
              {words.map((word, index) => (
                <Fragment key={index}>
                  <span data-chat="word" data-on={on(index < stage.words)}>
                    {word}
                  </span>{" "}
                </Fragment>
              ))}
            </p>
            {/* Fond sur chaque ligne : la liste vide ne se voit pas avant la réponse. */}
            <ul className="divide-y divide-border">
              {text.members.map(({ name, last }, index) => (
                <li
                  key={name}
                  data-chat=""
                  data-on={on(index < stage.rows)}
                  className="flex flex-wrap justify-between gap-x-4 gap-y-1 bg-background px-3 py-2 first:rounded-t-lg last:rounded-b-lg"
                >
                  <span className="font-medium">{name}</span>
                  <span className="text-muted-foreground tabular-nums">{last}</span>
                </li>
              ))}
            </ul>
            {/* Rayon 14 et marge 12 : la formule donne 2, les boutons gardent leur rayon. */}
            <div
              data-chat=""
              data-on={on(stage.proposal)}
              className="rounded-xl bg-card p-3 shadow-border"
            >
              <p className="text-xs font-semibold text-muted-foreground">{text.proposal}</p>
              <p className="mt-1 font-medium">{text.proposalSubject}</p>
              <div className="mt-3 flex justify-end gap-2" aria-hidden="true">
                <span className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold">
                  {text.edit}
                </span>
                <span className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                  {text.validate}
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* Champ de saisie dessiné : la question y est tapée avant de partir. */}
        <div
          aria-hidden="true"
          className="flex items-center gap-2 rounded-xl bg-background py-2 pr-2 pl-4 text-sm shadow-border"
        >
          {/* Texte en position absolue : une saisie longue ne peut pas élargir la colonne. */}
          <span className="relative h-5 min-w-0 flex-1">
            <span ref={field} className="absolute inset-0 flex overflow-hidden whitespace-nowrap">
              {stage.typed > 0 ? text.question.slice(0, stage.typed) : null}
              {stage.focus ? (
                <span className="h-5 w-px shrink-0 animate-caret bg-foreground" />
              ) : null}
              {stage.typed === 0 ? (
                <span className="text-muted-foreground">{text.placeholder}</span>
              ) : null}
            </span>
          </span>
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-300 ease-base",
              stage.typed > 0
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground",
            )}
          >
            <ArrowUpIcon aria-hidden="true" className="size-4" />
          </span>
        </div>
      </div>
    </figure>
  );
}
