import type { CSSProperties } from "react";
import BrandMotion from "./BrandMotion";
import type { TimelineEmployee } from "@/mocks/site";

interface DayTimelineProps {
  employees: TimelineEmployee[];
  dayLabel: string;
}

const TICKS = [0, 6, 12, 18, 24];

interface PlacedSegment {
  start: number;
  end: number;
  label: string;
  nextDay: boolean;
  wide: boolean;
}

function hourText(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  return `${String(h).padStart(2, "0")}:00`;
}

function placeSegments(employee: TimelineEmployee): PlacedSegment[] {
  const placed: PlacedSegment[] = [];
  employee.segments.forEach((segment) => {
    const wide = (segment.end - segment.start) / 24 >= 0.14;
    if (segment.end <= 24) {
      placed.push({
        start: segment.start,
        end: segment.end,
        label: segment.label,
        nextDay: false,
        wide,
      });
      return;
    }
    placed.push({
      start: segment.start,
      end: 24,
      label: `${hourText(segment.start)}–24:00`,
      nextDay: false,
      wide,
    });
    placed.push({
      start: 0,
      end: segment.end - 24,
      label: `다음날 00:00–${hourText(segment.end - 24)}`,
      nextDay: true,
      wide: (segment.end - 24) / 24 >= 0.14,
    });
  });
  return placed;
}

function tickOffset(tick: number): string {
  if (tick === 0) return "translate-x-0";
  if (tick === 24) return "-translate-x-full";
  return "-translate-x-1/2";
}

/**
 * 하루(00–24시)를 가로 막대로 보여주는 일간 근무 타임라인.
 * 자정을 넘는 근무는 "다음날"로 이어서 표시한다.
 * 모바일에서는 가로로 밀어 보도록 안내하고, 아래에 시간 목록을 함께 둔다.
 */
export default function DayTimeline({ employees, dayLabel }: DayTimelineProps) {
  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-[16px] text-foreground-700 lg:hidden">
        <i className="ri-drag-move-2-line text-[18px] text-primary-700" />
        시간표가 넓어요. 옆으로 밀어서 보세요.
      </p>

      <div className="overflow-x-auto rounded-md border border-background-200 bg-background-50 p-4">
        <div className="min-w-[600px]">
          <p className="mb-2 text-[15px] font-semibold text-foreground-700">{dayLabel}</p>

          <div className="relative ml-[92px] h-[26px] border-b border-background-200">
            {TICKS.map((tick) => (
              <span
                key={tick}
                className={`tabular absolute top-0 text-[13px] text-foreground-600 ${tickOffset(tick)}`}
                style={{ left: `${(tick / 24) * 100}%` }}
              >
                {String(tick).padStart(2, "0")}
              </span>
            ))}
          </div>

          <div className="mt-3 space-y-5">
            {employees.map((employee) => (
              <div key={employee.name} className="flex items-start gap-3">
                <div className="w-[80px] flex-none pt-1.5">
                  <p className="text-[16px] font-semibold text-foreground-950">{employee.name}</p>
                  <p className="mt-0.5 text-[13px] text-foreground-600">{employee.note}</p>
                </div>

                <div className="min-w-0 flex-1">
                  <BrandMotion className="relative h-[44px] rounded-md bg-background-100">
                    {TICKS.map((tick) => (
                      <span
                        key={tick}
                        aria-hidden="true"
                        className="absolute top-0 h-full w-px bg-background-200"
                        style={{ left: `${(tick / 24) * 100}%` }}
                      />
                    ))}
                    {placeSegments(employee).map((segment, index) => {
                      const barStyle: CSSProperties & Record<string, string | number> = {
                        left: `${(segment.start / 24) * 100}%`,
                        width: `${((segment.end - segment.start) / 24) * 100}%`,
                        "--bm-i": index,
                      };
                      return (
                        <div
                          key={`${employee.name}-${segment.start}-${index}`}
                          title={segment.label}
                          style={barStyle}
                          className={`bm-bar absolute top-[6px] flex h-[32px] items-center justify-center overflow-hidden rounded-md px-1.5 ${
                            segment.nextDay ? "bg-accent-400" : "bg-primary-500"
                          }`}
                        >
                          {segment.wide ? (
                            <span className="tabular truncate text-[13px] font-semibold text-background-50">
                              {segment.label}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </BrandMotion>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {employee.segments.map((segment) => (
                      <span
                        key={segment.label}
                        className="rounded-full bg-secondary-100 px-3 py-1 text-[14px] font-medium text-secondary-900"
                      >
                        {segment.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[15px] leading-relaxed text-foreground-600">
        막대 하나가 한 사람의 근무 시간이에요. 자정을 넘는 근무는 “다음날”로 이어서 표시해요.
      </p>
    </div>
  );
}