import { useState } from "react";
import ScreenFrame from "./ScreenFrame";
import { DEMO_EMPLOYEE_ROSTER } from "@/mocks/site";

const TONE: Record<string, string> = {
  ok: "bg-primary-50 text-primary-800",
  warn: "bg-accent-100 text-accent-900",
};

const DETAIL_ROWS = [
  { key: "phone", label: "연락처" },
  { key: "hireDate", label: "입사일" },
  { key: "pay", label: "급여 기준" },
  { key: "schedule", label: "근무 시간" },
  { key: "account", label: "급여 계좌" },
] as const;

/**
 * 직원 관리 화면 (공통 스테이지의 여섯 화면 중 하나).
 * 왼쪽 목록에서 직원을 고르면 오른쪽 상세가 바뀐다(모바일은 목록 아래에 상세).
 * 다른 화면을 흉내 내지 않고 직원 목록·상세만 보여준다. 데이터는 홈의 "확인할 일"과 같은 4명이다.
 */
export default function EmployeeScreen() {
  const [selectedId, setSelectedId] = useState(DEMO_EMPLOYEE_ROSTER[0].id);
  const selected =
    DEMO_EMPLOYEE_ROSTER.find((person) => person.id === selectedId) ?? DEMO_EMPLOYEE_ROSTER[0];

  return (
    <ScreenFrame title="직원 관리" meta={`직원 ${DEMO_EMPLOYEE_ROSTER.length}명 · 9월 23일 기준 (예시)`}>
      <div className="grid gap-4 md:grid-cols-[236px_1fr] md:items-start">
        {/* 직원 목록 */}
        <div className="min-w-0">
          <p className="mb-2 text-[15px] font-semibold text-foreground-800">직원 목록</p>
          <ul className="space-y-2">
            {DEMO_EMPLOYEE_ROSTER.map((person) => {
              const isActive = person.id === selectedId;
              return (
                <li key={person.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedId(person.id)}
                    aria-pressed={isActive}
                    className={`flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors ${
                      isActive
                        ? "border-primary-400 bg-primary-50"
                        : "border-background-200 bg-background-50 hover:border-primary-300"
                    }`}
                  >
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-secondary-100 text-[16px] font-semibold text-secondary-900">
                      {person.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold text-foreground-950">
                        {person.name}
                      </span>
                      <span className="block truncate text-[14px] text-foreground-600">
                        {person.role}
                      </span>
                    </span>
                    <span
                      className={`flex-none whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold ${TONE[person.tone]}`}
                    >
                      {person.status}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 직원 상세 */}
        <div className="min-w-0 rounded-md border border-background-200 bg-background-50 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-heading text-[20px] font-bold text-foreground-950">{selected.name}</p>
              <p className="mt-0.5 text-[15px] text-foreground-600">{selected.role}</p>
            </div>
            <span
              className={`whitespace-nowrap rounded-full px-3 py-1 text-[14px] font-semibold ${TONE[selected.tone]}`}
            >
              {selected.status}
            </span>
          </div>

          <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {DETAIL_ROWS.map((row) => (
              <div key={row.key} className="min-w-0">
                <dt className="text-[14px] text-foreground-600">{row.label}</dt>
                <dd className="mt-0.5 text-[16px] font-medium text-foreground-900">
                  {selected[row.key]}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-accent-200 bg-accent-50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[14px] text-accent-900/80">확인할 정보</p>
              <p className="mt-0.5 text-[16px] font-semibold text-accent-900">{selected.checkItem}</p>
            </div>
            <span className="flex min-h-[44px] flex-none items-center whitespace-nowrap rounded-md border border-accent-300 bg-background-50 px-4 text-[15px] font-semibold text-accent-900">
              {selected.checkState}
            </span>
          </div>

          <p className="mt-4 flex items-start gap-2 text-[14px] leading-relaxed text-foreground-600">
            <i className="ri-information-line mt-0.5 text-[16px] text-foreground-500" />
            화면 이해를 위한 예시예요. 입력한 직원 정보는 실제로 저장되지 않아요.
          </p>
        </div>
      </div>
    </ScreenFrame>
  );
}