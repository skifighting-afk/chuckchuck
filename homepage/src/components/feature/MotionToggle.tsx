import { useMotionPreference } from "@/hooks/useMotionPreference";

/**
 * 푸터의 작은 "움직임 줄이기" 토글.
 * 홈페이지 장식 모션(히어로 인사 영상 + 제품 시연 장식)을 한 번에 멈추거나 다시 켠다.
 * 48px 터치영역을 지키고, 기기에서 "움직임 줄이기"를 켜 둔 경우에는 안내만 남긴다.
 */
export default function MotionToggle() {
  const { motionOff, reduced, toggleMotion } = useMotionPreference();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={motionOff}
      onClick={toggleMotion}
      disabled={reduced}
      title={reduced ? "기기에서 움직임 줄이기를 켜 두었어요." : undefined}
      className={`flex min-h-[48px] items-center gap-2.5 whitespace-nowrap rounded-md border px-3 text-[15px] font-medium transition-colors ${
        reduced
          ? "cursor-not-allowed border-background-50/20 text-background-200"
          : "border-background-50/30 text-background-100 hover:bg-background-50/10"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-5 w-9 flex-none items-center rounded-full p-0.5 transition-colors ${
          motionOff ? "bg-accent-500" : "bg-background-50/25"
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-background-50 transition-transform ${
            motionOff ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
      움직임 줄이기
    </button>
  );
}