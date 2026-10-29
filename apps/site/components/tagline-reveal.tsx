"use client";

import { Fragment, useEffect, useRef } from "react";

/**
 * Phrase révélée mot à mot (skill B11) : les mots partent à 30 % d'opacité et s'allument un à un,
 * dans l'ordre de lecture, à mesure que le bloc franchit la ligne de déclenchement. Un seul
 * écouteur de défilement, limité par requestAnimationFrame, retiré une fois tout allumé.
 * Sur mobile, les lignes se suivent et s'équilibrent (aucun mot seul sur sa ligne).
 */
export function TaglineReveal({ lines, className }: { lines: string[]; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const block = ref.current;
    if (!block) return;
    const words = Array.from(block.querySelectorAll<HTMLElement>("[data-word]"));
    let lit = 0;
    let frame = 0;

    const light = (count: number) => {
      for (; lit < count; lit += 1) words[lit]?.setAttribute("data-on", "");
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      light(words.length);
      return;
    }

    const update = () => {
      frame = 0;
      const rect = block.getBoundingClientRect();
      // Ligne aux deux tiers de l'écran ; la révélation dure la hauteur du bloc plus un quart
      // d'écran de défilement.
      const trigger = window.innerHeight * 0.66;
      const progress = (trigger - rect.top) / (rect.height + window.innerHeight * 0.25);
      light(Math.min(words.length, Math.max(0, Math.ceil(progress * words.length))));
      if (lit >= words.length) stop();
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const stop = () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return stop;
  }, []);

  return (
    <p ref={ref} className={className}>
      {lines.map((line, lineIndex) => (
        <span key={line} className="sm:block">
          {lineIndex > 0 && " "}
          {line.split(" ").map((word, index) => (
            <Fragment key={index}>
              {index > 0 && " "}
              <span data-word="">{word}</span>
            </Fragment>
          ))}
        </span>
      ))}
    </p>
  );
}
