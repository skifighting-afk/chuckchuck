import { createElement, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

type BrandMotionTag = "div" | "section" | "article" | "li" | "span" | "p" | "ul";

interface BrandMotionProps {
  children: ReactNode;
  as?: BrandMotionTag;
  className?: string;
  threshold?: number;
}

/**
 * 브랜드 제품체험용 모션 컨트롤러.
 * 화면에 들어오면 is-play 를 붙여 자식의 짧은 모션을 딱 한 번 재생한다.
 * 모션 대상은 장식(막대·체크)이고, 글자는 여기서 숨기지 않는다.
 * prefers-reduced-motion 이면 모션 없이 바로 최종 상태로 보여준다.
 */
export default function BrandMotion({
  children,
  as = "div",
  className = "",
  threshold = 0.2,
}: BrandMotionProps) {
  const ref = useRef<HTMLElement | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    if (reduced || typeof IntersectionObserver === "undefined") {
      el.classList.add("is-play");
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-play");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced, threshold]);

  return createElement(
    as,
    { ref, className: `bm ${className}` } as Record<string, unknown>,
    children,
  );
}