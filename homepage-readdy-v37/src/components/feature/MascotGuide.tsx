import type { CSSProperties } from "react";
import BrandMotion from "./BrandMotion";
import Cheokcheoki from "@/components/base/Cheokcheoki";
import { MASCOT_GUIDES } from "@/mocks/site";

interface MascotGuideProps {
  stepId: string;
  headline: string;
  badge?: string;
  onBack?: () => void;
  className?: string;
}

/**
 * 출근 체크 장식: 체크 선이 주기적으로 한 번 그어진다.
 */
function CheckMotif() {
  const style: CSSProperties & Record<string, string | number> = {
    "--mg-len": 15,
    strokeDasharray: 15,
  };
  return (
    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-primary-50 text-primary-600">
      <svg width={18} height={18} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
        <path
          className="mg-draw"
          d="M9.5 16.5 14 21 22.5 11"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={style}
        />
      </svg>
    </span>
  );
}

/**
 * 시간 막대 장식: 근무 시간 막대가 주기적으로 자라났다 돌아간다.
 */
function ScheduleBar() {
  return (
    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-primary-50">
      <span className="mg-grow block h-[7px] w-4 rounded-full bg-primary-500" />
    </span>
  );
}

/**
 * 급여 검토선 장식: 옅은 줄 위로 검토 줄이 주기적으로 그어진다.
 */
function ReviewLine() {
  const style: CSSProperties & Record<string, string | number> = {
    "--mg-len": 13,
    strokeDasharray: 13,
  };
  return (
    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-primary-50 text-primary-600">
      <svg width={18} height={18} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M3 6h14M3 11h9"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          className="mg-draw-line"
          d="M3 15h13"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          style={style}
        />
      </svg>
    </span>
  );
}

/**
 * 탭(출퇴근·근무표·급여)마다 다른 장식이 각기 다른 박자로 짧게 반복된다.
 * 출근 체크 표시 · 시간 막대 · 급여 검토선.
 */
function Motif({ stepId }: { stepId: string }) {
  if (stepId === "clock") return <CheckMotif />;
  if (stepId === "schedule") return <ScheduleBar />;
  return <ReviewLine />;
}

/**
 * 제품체험 화면 위에 붙는 척척이 안내.
 * 72px 척척이가 7~9초 주기로 아주 살짝 고개를 끄덕이고, 탭에 맞는 한 문장과 기능 장식이 반복된다.
 * 입력이나 금액 변화를 흉내내지 않고, 화면 안에만 들어간다(페이지 길이를 늘리지 않는다).
 */
export default function MascotGuide({
  stepId,
  headline,
  badge = "화면 이해를 위한 예시",
  onBack,
  className = "",
}: MascotGuideProps) {
  const guide = MASCOT_GUIDES[stepId] ?? MASCOT_GUIDES.clock;

  return (
    <BrandMotion
      className={`flex flex-col gap-3 border-b border-background-200 bg-background-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-[72px] w-[72px] flex-none items-center justify-center">
          <span className="mg-nod flex h-full w-full items-center justify-center">
            <Cheokcheoki />
          </span>
        </span>
        <div className="mg-bubble relative min-w-0 rounded-lg border border-background-200 bg-background-50 px-4 py-3">
          <p className="font-heading text-[18px] font-semibold leading-snug text-foreground-950">
            {guide}
          </p>
          <p className="mt-1 text-[15px] leading-snug text-foreground-600">{headline}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <Motif stepId={stepId} />
        {badge ? (
          <span className="whitespace-nowrap rounded-full bg-secondary-100 px-3 py-1 text-[14px] font-medium text-secondary-900">
            {badge}
          </span>
        ) : null}
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex min-h-[48px] items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 text-[15px] font-semibold text-foreground-800 transition-colors hover:border-primary-400"
          >
            <i className="ri-arrow-left-line text-[18px]" />
            요약으로 돌아가기
          </button>
        ) : null}
      </div>
    </BrandMotion>
  );
}