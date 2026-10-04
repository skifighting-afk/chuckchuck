import { useTextSize } from "@/hooks/useTextSize";

interface TextSizeToggleProps {
  className?: string;
}

/**
 * 푸터의 작은 "글씨 크게 보기" 토글.
 * 사이트 전체 글자 크기를 한 단계 키우거나 되돌린다.
 * 제품체험 본문 영역을 차지하지 않도록 푸터에만 둔다.
 */
export default function TextSizeToggle({ className = "" }: TextSizeToggleProps) {
  const { large, toggle } = useTextSize();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={large}
      className={`flex min-h-[48px] items-center gap-2.5 whitespace-nowrap rounded-md border border-background-50/30 px-3 text-[15px] font-medium text-background-100 transition-colors hover:bg-background-50/10 ${className}`}
    >
      <i className={`${large ? "ri-font-size-2" : "ri-font-size"} text-[17px]`} />
      {large ? "글씨 원래대로" : "글씨 크게 보기"}
    </button>
  );
}