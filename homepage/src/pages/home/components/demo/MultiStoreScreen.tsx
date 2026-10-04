import { useState } from "react";
import ScreenFrame from "./ScreenFrame";
import ScrollHint from "./ScrollHint";
import { DEMO_MONTHS, DEMO_MULTI_STORES } from "@/mocks/site";

export default function MultiStoreScreen() {
  const [month, setMonth] = useState(DEMO_MONTHS[0]);

  return (
    <ScreenFrame
      title="매장 관리·비교"
      meta="여러 가게를 한 번에 비교해요 (예시)"
      action={
        <div className="flex items-center gap-1 rounded-md border border-background-200 bg-background-50 p-1">
          {DEMO_MONTHS.map((item) => {
            const isActive = item === month;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setMonth(item)}
                aria-pressed={isActive}
                className={`flex min-h-[40px] items-center rounded-md px-4 text-[15px] font-semibold transition-colors ${
                  isActive ? "bg-primary-600 text-background-50" : "text-foreground-700"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      }
    >
      <div className="rounded-md border border-accent-200 bg-accent-50 p-4">
        <p className="text-[16px] font-semibold text-accent-900">여러 가게 통합 비교를 사전 체험에서 쓸 수 있어요.</p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-accent-900/80">
          매출이 연결되어 있지 않아 매출이나 이익률은 보여주지 않아요. 직원 수, 실근무 시간, 인건비,
          퇴근 확인 건수만 비교해요.
        </p>
      </div>

      <div className="mb-3 mt-5 flex items-center justify-between gap-2">
        <p className="text-[15px] font-semibold text-foreground-800">{month} 기준 가게 비교</p>
        <span className="rounded-full border border-background-300 px-3 py-1 text-[14px] text-foreground-600">
          사전 체험 제공
        </span>
      </div>

      <ScrollHint />

      <div className="overflow-x-auto rounded-md border border-background-200 bg-background-50">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[1.3fr_repeat(4,minmax(0,1fr))_1.1fr] border-b border-background-200 bg-background-100">
            {["매장", "직원수", "실근무시간", "인건비", "퇴근 확인", "전환"].map((head) => (
              <div key={head} className="px-3 py-3 text-[15px] font-semibold text-foreground-800">
                {head}
              </div>
            ))}
          </div>
          {DEMO_MULTI_STORES.map((row) => (
            <div
              key={row.store}
              className="grid grid-cols-[1.3fr_repeat(4,minmax(0,1fr))_1.1fr] items-center border-b border-background-200 last:border-b-0"
            >
              <div className="px-3 py-3 text-[15px] font-semibold text-foreground-900">{row.store}</div>
              <div className="px-3 py-3 text-[15px] text-foreground-800">{row.staff}</div>
              <div className="tabular px-3 py-3 text-[15px] text-foreground-800">{row.hours}</div>
              <div className="tabular px-3 py-3 text-[15px] text-foreground-800">{row.cost}</div>
              <div className="px-3 py-3 text-[15px] text-foreground-800">{row.checkouts}</div>
              <div className="px-3 py-3">
                <span className="flex min-h-[40px] items-center justify-center rounded-md bg-primary-600 px-2 text-[14px] font-semibold text-background-50">
                  이 매장 열기
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScreenFrame>
  );
}