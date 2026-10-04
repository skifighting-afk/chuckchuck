import { useState } from "react";
import ScreenFrame from "./ScreenFrame";
import { CHARACTER, CHEOKCHEOKI_GUIDE, DEMO_HOME_SUMMARY } from "@/mocks/site";

export type SummaryTarget = "clock" | "schedule" | "payroll";

interface HomeSummaryScreenProps {
  onOpen: (view: SummaryTarget) => void;
}

/**
 * "우리 가게" 홈 요약 화면 (홈·제품 페이지 공통 기본 화면).
 * - 가장 큰 카드: 이번 달 예상 급여(가상 금액)와 "검토 전" 기준, 주 버튼 "급여 자세히 보기".
 * - 오늘 출근 줄을 누르면 출근 상세로, 그 아래 작은 링크를 누르면 근무표 상세로 간다.
 * - "확인할 일"은 다른 화면으로 넘어가지 않고, 직원정보 확인 목록을 접고 편다.
 * - 안내 자세 척척이(72px)를 카드 모서리에 흐름 배치로 두어 금액을 가리지 않는다.
 */
export default function HomeSummaryScreen({ onOpen }: HomeSummaryScreenProps) {
  const { store, meta, salary, clock, scheduleLink, confirm, note } = DEMO_HOME_SUMMARY;
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <ScreenFrame title={store} meta={meta}>
      <div className="mx-auto w-full max-w-[600px]">
        {/* 이번 달 예상 급여 — 가장 큰 카드 */}
        <div className="rounded-lg border border-primary-300 bg-primary-50/70 p-4 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-primary-800">{salary.title}</p>
              <p className="tabular mt-2 whitespace-nowrap font-heading text-[30px] font-bold leading-none text-foreground-950 md:text-[40px]">
                {salary.amount}
              </p>
              <p className="mt-2.5 text-[15px] leading-snug text-foreground-700">{salary.basis}</p>
            </div>
            {/* 새 공식 안내 자세 척척이 — 72px, 밝은 크림 배경, 금액을 가리지 않는다 */}
            <span className="char-float flex h-[72px] w-[72px] flex-none items-center justify-center">
              <img
                src={CHEOKCHEOKI_GUIDE}
                alt={`${CHARACTER.alt} 안내 자세`}
                width={72}
                height={72}
                decoding="async"
                className="h-full w-full rounded-2xl bg-background-50 object-contain"
              />
            </span>
          </div>

          <button
            type="button"
            onClick={() => onOpen("payroll")}
            className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-600 px-5 text-[17px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
          >
            {salary.cta}
            <i className="ri-arrow-right-line text-[18px]" />
          </button>
        </div>

        {/* 오늘 상태 */}
        <div className="mt-3">
          {/* 오늘 출근 — 누르면 출근 상세 */}
          <button
            type="button"
            onClick={() => onOpen("clock")}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-background-200 bg-background-50 px-4 py-3 text-left transition-colors hover:border-primary-400"
          >
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-primary-50 text-primary-700">
                <i className="ri-time-line text-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] text-foreground-600">{clock.label}</span>
                <span className="block text-[17px] font-semibold text-foreground-950">
                  {clock.value}
                </span>
              </span>
            </span>
            <i className="ri-arrow-right-s-line flex-none text-[20px] text-foreground-500" />
          </button>

          {/* 오늘 근무표 보기 — 출근 줄 바로 아래의 작은 링크 */}
          <div className="mt-1 pl-1">
            <button
              type="button"
              onClick={() => onOpen("schedule")}
              className="inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[14px] font-semibold text-primary-700 transition-colors hover:bg-primary-50 hover:text-primary-800"
            >
              <i className="ri-calendar-schedule-line text-[16px]" />
              {scheduleLink.label}
              <i className="ri-arrow-right-s-line text-[16px]" />
            </button>
          </div>

          {/* 확인할 일 — 누르면 직원정보 확인 목록을 접고 편다(다른 화면으로 넘어가지 않음) */}
          <button
            type="button"
            onClick={() => setConfirmOpen((prev) => !prev)}
            aria-expanded={confirmOpen}
            className="mt-2.5 flex w-full items-center justify-between gap-3 rounded-lg border border-background-200 bg-background-50 px-4 py-3 text-left transition-colors hover:border-primary-400"
          >
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-accent-100 text-accent-900">
                <i className="ri-alert-line text-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] text-foreground-600">{confirm.label}</span>
                <span className="block text-[17px] font-semibold text-foreground-950">
                  {confirm.value}
                </span>
              </span>
            </span>
            <span className="flex flex-none items-center gap-1 whitespace-nowrap text-[14px] font-semibold text-primary-700">
              {confirmOpen ? "접기" : "펼치기"}
              <i
                className={
                  confirmOpen
                    ? "ri-arrow-up-s-line text-[18px]"
                    : "ri-arrow-down-s-line text-[18px]"
                }
              />
            </span>
          </button>

          {confirmOpen ? (
            <ul className="mt-2 space-y-2 rounded-lg border border-background-200 bg-background-50 p-3">
              <li className="px-1 text-[14px] font-semibold text-foreground-600">
                {confirm.action} · {confirm.items.length}명
              </li>
              {confirm.items.map((person) => (
                <li
                  key={person.name}
                  className="flex items-center justify-between gap-3 rounded-md border border-background-200 bg-background-100 px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block text-[16px] font-semibold text-foreground-950">
                      {person.name}
                    </span>
                    <span className="block text-[14px] text-foreground-600">{person.item}</span>
                  </span>
                  <span className="flex-none whitespace-nowrap rounded-full bg-accent-100 px-3 py-1 text-[13px] font-semibold text-accent-900">
                    {person.state}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <p className="mt-4 flex items-start gap-2 text-[14px] leading-relaxed text-foreground-600">
          <i className="ri-information-line mt-0.5 text-[16px] text-foreground-500" />
          {note}
        </p>
      </div>
    </ScreenFrame>
  );
}