import { useState } from "react";
import Anno from "./Anno";
import ScreenFrame from "./ScreenFrame";
import ScrollHint from "./ScrollHint";
import DayTimeline from "@/components/feature/DayTimeline";
import {
  DEMO_DAYS,
  DEMO_EMPLOYEES,
  DEMO_SHIFT,
  DEMO_SHIFT_NOTE,
  DEMO_TIMELINE,
  DEMO_TIMELINE_DAY,
} from "@/mocks/site";

type ScheduleView = "day" | "week";

const VIEWS: { id: ScheduleView; label: string }[] = [
  { id: "day", label: "일간 보기" },
  { id: "week", label: "주간 보기" },
];

export default function ScheduleScreen() {
  const [view, setView] = useState<ScheduleView>("day");

  return (
    <ScreenFrame
      title="근무 스케줄"
      meta={view === "day" ? DEMO_TIMELINE_DAY : "이번 주 (예시)"}
      action={
        <div className="flex items-center gap-2">
          <Anno n={2} />
          <span className="flex min-h-[48px] items-center rounded-md bg-primary-600 px-4 text-[16px] font-semibold text-background-50">
            근무표 저장
          </span>
        </div>
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <Anno n={1} />
        <p className="text-[15px] text-foreground-700">
          같은 근무표를 일간과 주간으로 나눠 볼 수 있어요.
        </p>
      </div>

      <div className="mb-4 inline-flex items-center gap-1 rounded-full border border-background-200 bg-background-50 p-1">
        {VIEWS.map((item) => {
          const isActive = item.id === view;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              aria-pressed={isActive}
              className={`flex min-h-[48px] items-center rounded-full px-5 text-[16px] font-semibold transition-colors ${
                isActive
                  ? "bg-primary-600 text-background-50"
                  : "text-foreground-700 hover:text-foreground-950"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {view === "day" ? (
        <DayTimeline employees={DEMO_TIMELINE} dayLabel={DEMO_TIMELINE_DAY} />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2">
            <p className="text-[15px] text-foreground-700">{DEMO_SHIFT_NOTE}</p>
          </div>

          <ScrollHint />

          <div className="overflow-x-auto rounded-md border border-background-200 bg-background-50">
            <div className="min-w-[780px]">
              <div className="grid grid-cols-[110px_repeat(7,minmax(0,1fr))] border-b border-background-200 bg-background-100">
                <div className="px-3 py-3 text-[15px] font-semibold text-foreground-800">직원</div>
                {DEMO_DAYS.map((day, index) => (
                  <div
                    key={day}
                    className={`px-2 py-3 text-center text-[15px] font-semibold ${
                      index >= 5 ? "text-accent-900" : "text-foreground-800"
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {DEMO_EMPLOYEES.map((name) => (
                <div
                  key={name}
                  className="grid grid-cols-[110px_repeat(7,minmax(0,1fr))] border-b border-background-200 last:border-b-0"
                >
                  <div className="flex items-center border-r border-background-200 px-3 py-3 text-[15px] font-semibold text-foreground-900">
                    {name}
                  </div>
                  {DEMO_DAYS.map((day) => (
                    <div
                      key={`${name}-${day}`}
                      className="tabular flex items-center justify-center border-r border-background-200 px-1.5 py-3 text-[14px] font-medium text-foreground-800 last:border-r-0"
                    >
                      {DEMO_SHIFT}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </ScreenFrame>
  );
}