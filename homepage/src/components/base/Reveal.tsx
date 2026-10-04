import { createElement, useEffect, useRef } from "react";
import type { ReactNode } from "react";

type RevealVariant = "up" | "fade" | "left" | "right" | "scale";
type RevealTag = "div" | "section" | "article" | "li" | "span" | "p";

interface RevealProps {
  children: ReactNode;
  variant?: RevealVariant;
  delay?: number;
  className?: string;
  as?: RevealTag;
}

export default function Reveal({
  children,
  variant = "up",
  delay = 0,
  className = "",
  as = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-visible");
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const style = delay > 0 ? { transitionDelay: `${delay}ms` } : undefined;

  return createElement(
    as,
    {
      ref,
      "data-reveal": variant,
      className,
      style,
    } as Record<string, unknown>,
    children,
  );
}