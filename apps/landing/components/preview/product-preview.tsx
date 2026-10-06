"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Step } from "@/content/landing";
import { track } from "@/lib/analytics";

type Props = {
  brandName: string;
  label: string;
  navTitle: string;
  navHint: string;
  live: { prefix: string; suffix: string; initial: number };
  steps: readonly Step[];
  /** Nombre d'outils affiché sur l'onglet Intégrations. */
  integrationsCount: number;
  /** Vues rendues côté serveur, dans l'ordre des étapes. */
  panels: React.ReactNode[];
};

function subscribeMedia(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMedia,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

function usePageHidden(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.hidden,
    () => false,
  );
}

/**
 * Fenêtre de l'aperçu (§2.3) : onglets accessibles, défilement automatique toutes les 4 s (piloté
 * par la fin de l'animation de la barre de progression), arrêté au premier choix d'une étape, en
 * pause au survol, au focus, hors écran ou onglet masqué. Avec « réduire les animations » :
 * ni défilement automatique ni compteur animé.
 */
export function ProductPreview({
  brandName,
  label,
  navTitle,
  navHint,
  live,
  steps,
  integrationsCount,
  panels,
}: Props) {
  const [active, setActive] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inView, setInView] = useState(true);
  const [checkins, setCheckins] = useState(live.initial);
  const reduced = useReducedMotion();
  const hidden = usePageHidden();
  const root = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const autoplay = !stopped && !reduced;
  const paused = hovered || focused || !inView || hidden;
  const current = steps[active] ?? steps[0];

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? true),
      {
        threshold: 0.2,
      },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Compteur « En direct » : illustration, avance de temps en temps quand l'aperçu est visible.
  useEffect(() => {
    if (reduced || !inView || hidden) return;
    const timer = window.setInterval(() => {
      if (Math.random() < 0.6) setCheckins((count) => count + 1);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [reduced, inView, hidden]);

  function select(index: number, focus = false) {
    const step = steps[index];
    if (!step) return;
    setActive(index);
    setStopped(true);
    track({ name: "apercu_etape", props: { etape: step.id } });
    if (focus) tabs.current[index]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const last = steps.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: active === last ? 0 : active + 1,
      ArrowRight: active === last ? 0 : active + 1,
      ArrowUp: active === 0 ? last : active - 1,
      ArrowLeft: active === 0 ? last : active - 1,
      Home: 0,
      End: last,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next, true);
  }

  return (
    <div
      ref={root}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
    >
      {/* Barre de titre */}
      <div className="flex h-10 items-center gap-2 border-b border-border px-4">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-border" />
        <span aria-hidden="true" className="size-2.5 rounded-full bg-border" />
        <span aria-hidden="true" className="size-2.5 rounded-full bg-border" />
        <span className="ml-3 hidden truncate font-mono text-xs text-muted-foreground sm:inline">
          {brandName} · {current?.label}
        </span>
        <span className="ml-auto inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase">
          <span aria-hidden="true" className="size-2 animate-pulse-dot rounded-full bg-success" />
          {live.prefix} · <span className="tabular-nums">{checkins}</span> {live.suffix}
        </span>
      </div>
      {/* Progression du défilement automatique */}
      <div aria-hidden="true" className="h-0.5 bg-muted">
        {autoplay ? (
          <div
            key={active}
            data-paused={paused || undefined}
            onAnimationEnd={() => setActive((index) => (index + 1) % steps.length)}
            className="autoplay-bar h-0.5 bg-primary"
          />
        ) : null}
      </div>

      <div className="flex flex-wrap md:min-h-[560px]">
        <div className="flex min-w-0 flex-[1_1_100%] flex-col gap-0.5 border-b border-border bg-background px-3 py-5 md:flex-[0_1_230px] md:border-r md:border-b-0">
          <p className="px-2.5 pb-1 font-mono text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            {navTitle}
          </p>
          <p className="px-2.5 pb-3 text-xs text-muted-foreground">{navHint}</p>
          <div
            role="tablist"
            aria-label={label}
            aria-orientation="vertical"
            onKeyDown={onKeyDown}
            className="grid grid-cols-2 gap-0.5 md:flex md:flex-col"
          >
            {steps.map((step, index) => {
              const selected = index === active;
              const isIntegrations = step.num === null;
              return (
                <button
                  key={step.id}
                  ref={(element) => {
                    tabs.current[index] = element;
                  }}
                  id={`apercu-onglet-${step.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`apercu-vue-${step.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(index)}
                  className={`flex min-h-11 w-full cursor-pointer flex-col justify-center rounded-lg border px-2.5 py-1.5 text-left text-sm transition-[background-color,border-color] duration-200 hover:border-border hover:bg-card ${
                    selected ? "border-border bg-card" : "border-transparent"
                  } ${isIntegrations ? "relative md:mt-[25px] md:before:absolute md:before:inset-x-2.5 md:before:-top-[13px] md:before:border-t md:before:border-border md:before:content-['']" : ""}`}
                >
                  <span className="flex w-full items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className={`grid size-[26px] shrink-0 place-items-center rounded-lg font-mono text-[11px] font-semibold ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-border text-foreground"
                      }`}
                    >
                      {step.num ?? <PlugIcon />}
                    </span>
                    <span className={`flex-1 ${selected ? "font-semibold" : ""}`}>
                      {step.label}
                    </span>
                    {isIntegrations ? (
                      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                        {integrationsCount}
                      </span>
                    ) : null}
                  </span>
                  {step.items ? (
                    // Présent dans le HTML pour chaque étape, affiché sous l'étape active (bureau).
                    <span
                      className={`hidden pt-1.5 pb-1 pl-[38px] text-xs leading-normal text-muted-foreground ${selected ? "md:block" : ""}`}
                    >
                      {step.items}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid min-w-0 flex-[999_1_520px] p-4 sm:p-6">
          {steps.map((step, index) => {
            const selected = index === active;
            return (
              <div
                key={step.id}
                id={`apercu-vue-${step.id}`}
                role="tabpanel"
                aria-labelledby={`apercu-onglet-${step.id}`}
                data-view={step.id}
                data-active={selected || undefined}
                inert={!selected}
                className={`[grid-area:1/1] ${selected ? "" : "invisible"}`}
              >
                {panels[index]}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PlugIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 7V3M15 7V3M7 7h10v5a5 5 0 0 1-10 0z" />
      <path d="M12 17v4" />
    </svg>
  );
}
