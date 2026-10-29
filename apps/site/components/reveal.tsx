"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Apparition au défilement (skill B7) : le bloc monte de 32 px en 700 ms la première fois qu'il
 * entre à l'écran, sans rejouer. Styles dans globals.css (`[data-reveal]`) ; sans JavaScript, le
 * contenu reste visible.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        element.setAttribute("data-revealed", "");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal=""
      className={className}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
