import type { CSSProperties } from "react";

interface CheckMarkProps {
  size?: number;
  className?: string;
}

/**
 * 척척이의 체크 표시를 직접 그린 SVG.
 * 부모(BrandMotion)에 is-play 가 붙으면 선이 360ms 동안 그려진다.
 * prefers-reduced-motion 이면 선을 바로 최종 상태로 보여준다.
 */
export default function CheckMark({ size = 28, className = "" }: CheckMarkProps) {
  const pathStyle: CSSProperties & Record<string, string | number> = {
    "--bm-len": 20,
    strokeDasharray: 20,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={`text-primary-600 ${className}`}
    >
      <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <path
        d="M9.5 16.5 14 21 22.5 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="bm-check-path"
        style={pathStyle}
      />
    </svg>
  );
}