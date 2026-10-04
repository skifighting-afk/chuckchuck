import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { DEMO_EMPLOYEE_ROSTER, DEMO_PAYROLL } from "@/mocks/site";

type Tab = "owner" | "employee";
type Stage = "before" | "working" | "resting" | "done";

const BRANCHES = ["본점", "2호점"] as const;
type Branch = (typeof BRANCHES)[number];

const TABS: { id: Tab; label: string }[] = [
  { id: "owner", label: "사장님" },
  { id: "employee", label: "직원" },
];

const EMPLOYEE_NAME = "김예시";
const SHIFT_LABEL = "오늘 09:00–17:00";

// 홈·제품 시연과 같은 가상 직원 데이터를 그대로 쓴다(본인 예시만 노출).
const KIM = DEMO_EMPLOYEE_ROSTER.find((person) => person.name === EMPLOYEE_NAME) ?? DEMO_EMPLOYEE_ROSTER[0];
const KIM_PAY = DEMO_PAYROLL.find((row) => row.name === EMPLOYEE_NAME);

const STAGE_LABEL: Record<Stage, string> = {
  before: "출근 전",
  working: "근무 중",
  resting: "휴게 중",
  done: "퇴근 완료",
};

const STAGE_TONE: Record<Stage, string> = {
  before: "bg-secondary-100 text-secondary-900",
  working: "bg-primary-100 text-primary-800",
  resting: "bg-accent-100 text-accent-900",
  done: "bg-background-200 text-foreground-800",
};

function nowLabel(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function minutesSince(label: string): number {
  const [hour, minute] = label.split(":").map(Number);
  const start = new Date();
  start.setHours(hour, minute, 0, 0);
  return Math.max(1, Math.round((Date.now() - start.getTime()) / 60000));
}

function workedLabel(clockIn: string | null, clockOut: string | null, rest: number): string {
  if (!clockIn || !clockOut) return "—";
  const [inHour, inMinute] = clockIn.split(":").map(Number);
  const [outHour, outMinute] = clockOut.split(":").map(Number);
  const total = outHour * 60 + outMinute - (inHour * 60 + inMinute) - rest;
  if (total <= 0) return "—";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours}시간 ${minutes}분`;
}

interface QRStaffDemoProps {
  /** 기본값은 접힘. QR로 들어온 직원 화면(employeeDemo=1)이면 자동으로 펼친다. */
  defaultOpen?: boolean;
  className?: string;
}

/**
 * 직원 QR 출근 체험 (홈·가이드 공통 재사용).
 * - 사장님/직원 탭이 같은 메모리 state를 공유한다.
 * - 사장님: 본점/2호점을 고르면 실제 사이트의 /try?employeeDemo=1&branch=... 주소로 QR을 만든다.
 * - 직원: 가상 김예시가 출근 → 휴게 시작 → 복귀 → 퇴근(확인/취소) 순서로 진행한다.
 *   현재 가능한 버튼만 보이고, 중복 출근은 막힌다. 퇴근 뒤에는 "오늘 근무를 마쳤어요"를 보여준다.
 * - 서버 없이 화면에서만 동작하고, 실제 개인정보 입력·카메라 요청이 없다.
 */
export default function QRStaffDemo({ defaultOpen = false, className = "" }: QRStaffDemoProps) {
  const [searchParams] = useSearchParams();
  const isEmployeeDemo = searchParams.get("employeeDemo") === "1";
  const branchParam = searchParams.get("branch");
  const initialBranch: Branch = BRANCHES.includes(branchParam as Branch)
    ? (branchParam as Branch)
    : "본점";

  const [open, setOpen] = useState<boolean>(defaultOpen || isEmployeeDemo);
  const [tab, setTab] = useState<Tab>(isEmployeeDemo ? "employee" : "owner");
  const [branch, setBranch] = useState<Branch>(initialBranch);

  // 사장님·직원 탭이 공유하는 출근 상태(메모리 state · 서버 저장 없음)
  const [stage, setStage] = useState<Stage>("before");
  const [clockInAt, setClockInAt] = useState<string | null>(null);
  const [restStartAt, setRestStartAt] = useState<string | null>(null);
  const [restMinutes, setRestMinutes] = useState(0);
  const [clockOutAt, setClockOutAt] = useState<string | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const internalUrl = `/try?employeeDemo=1&branch=${encodeURIComponent(branch)}`;
  const qrUrl = useMemo(() => {
    const base = __BASE_PATH__.endsWith("/") ? __BASE_PATH__.slice(0, -1) : __BASE_PATH__;
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}${base}${internalUrl}`;
  }, [internalUrl]);

  const clockIn = () => {
    if (stage !== "before") return; // 중복 출근 방지
    setClockInAt(nowLabel());
    setStage("working");
  };

  const startRest = () => {
    if (stage !== "working") return;
    setRestStartAt(nowLabel());
    setStage("resting");
  };

  const endRest = () => {
    if (stage !== "resting") return;
    if (restStartAt) setRestMinutes((prev) => prev + minutesSince(restStartAt));
    setRestStartAt(null);
    setStage("working");
  };

  const openClockOut = () => {
    if (stage !== "working") return;
    setConfirmOut(true);
  };

  const confirmClockOut = () => {
    if (stage !== "working") return;
    setClockOutAt(nowLabel());
    setStage("done");
    setConfirmOut(false);
  };

  const resetDemo = () => {
    setStage("before");
    setClockInAt(null);
    setRestStartAt(null);
    setRestMinutes(0);
    setClockOutAt(null);
    setConfirmOut(false);
    setConfirmReset(false);
  };

  return (
    <div className={`rounded-lg border border-background-200 bg-background-50 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-background-100"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-primary-50 text-primary-700">
            <i className="ri-qr-code-line text-[20px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-[16px] font-semibold text-foreground-950">직원 출근 체험</span>
            <span className="mt-0.5 block text-[14px] leading-relaxed text-foreground-600">
              QR로 직원 화면을 열고 출근·휴게·퇴근을 눌러 보세요. (가상 예시)
            </span>
          </span>
        </span>
        <span className="flex flex-none items-center gap-1 whitespace-nowrap text-[14px] font-semibold text-primary-700">
          {open ? "접기" : "펼치기"}
          <i className={open ? "ri-arrow-up-s-line text-[18px]" : "ri-arrow-down-s-line text-[18px]"} />
        </span>
      </button>

      {open ? (
        <div className="border-t border-background-200 p-4 md:p-5">
          <div className="inline-flex rounded-full border border-background-200 bg-background-100 p-1">
            {TABS.map((item) => {
              const isActive = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  aria-pressed={isActive}
                  className={`min-h-[40px] cursor-pointer whitespace-nowrap rounded-full px-5 text-[15px] font-semibold transition-colors ${
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

          {tab === "owner" ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[15px] font-semibold text-foreground-800">어느 가게 QR인가요?</p>
                <div className="mt-2 inline-flex rounded-full border border-background-200 bg-background-100 p-1">
                  {BRANCHES.map((item) => {
                    const isActive = branch === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setBranch(item)}
                        aria-pressed={isActive}
                        className={`min-h-[40px] cursor-pointer whitespace-nowrap rounded-full px-5 text-[15px] font-semibold transition-colors ${
                          isActive
                            ? "bg-primary-600 text-background-50"
                            : "text-foreground-700 hover:text-foreground-950"
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
                <div className="rounded-lg border border-background-200 bg-background-50 p-3 text-center">
                  <span className="inline-block rounded-md bg-white p-2.5">
                    <QRCodeCanvas value={qrUrl} size={168} bgColor="#ffffff" fgColor="#111111" />
                  </span>
                  <p className="mt-2 text-[13px] text-foreground-600">휴대폰 카메라로 찍어 보세요</p>
                </div>

                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-foreground-900">
                    {branch} 직원 출근 화면 주소
                  </p>
                  <ol className="mt-2 space-y-1.5 text-[14px] leading-relaxed text-foreground-700">
                    <li>① 직원이 휴대폰 카메라로 QR을 찍어요.</li>
                    <li>② 화면만 열려요. 출근은 직원이 버튼을 눌러야 기록돼요.</li>
                    <li>③ 스캔이 안 되면 아래 주소를 눌러 열 수 있어요.</li>
                  </ol>
                  <a
                    href={qrUrl}
                    className="mt-3 block break-all rounded-md border border-background-200 bg-background-100 px-3 py-2 text-[13px] text-primary-700 transition-colors hover:border-primary-400"
                  >
                    {qrUrl}
                  </a>
                  <Link
                    to={internalUrl}
                    className="mt-3 inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-5 text-[15px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
                  >
                    <i className="ri-external-link-line text-[16px]" />
                    직원 화면 열기
                  </Link>
                </div>
              </div>

              <div className="rounded-lg border border-background-200 bg-background-100 p-4">
                <p className="text-[15px] font-semibold text-foreground-800">
                  {branch} 출근 체험 기록
                </p>
                {stage === "before" ? (
                  <p className="mt-2 text-[15px] text-foreground-600">
                    아직 기록이 없어요. 직원 탭에서 출근을 눌러 보세요.
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                    <span className="text-[15px] font-semibold text-foreground-950">
                      {EMPLOYEE_NAME}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-[13px] font-semibold ${STAGE_TONE[stage]}`}
                    >
                      {STAGE_LABEL[stage]}
                    </span>
                    <span className="tabular text-[15px] text-foreground-700">
                      출근 {clockInAt ?? "—"}
                    </span>
                    <span className="tabular text-[15px] text-foreground-700">
                      퇴근 {clockOutAt ?? "—"}
                    </span>
                    <span className="text-[15px] text-foreground-700">
                      휴게 {restMinutes > 0 ? `${restMinutes}분` : "—"}
                    </span>
                  </div>
                )}
                <p className="mt-2 text-[13px] leading-relaxed text-foreground-600">
                  직원 탭과 같은 기록이에요. 이미 출근한 상태에서는 중복 출근이 막혀요.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-primary-300 bg-primary-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[17px] font-semibold text-foreground-950">
                      {EMPLOYEE_NAME} <span className="text-[14px] text-foreground-600">(가상 직원)</span>
                    </p>
                    <p className="mt-0.5 text-[15px] text-foreground-700">
                      {branch} · {SHIFT_LABEL}
                    </p>
                  </div>
                  <span
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-semibold ${STAGE_TONE[stage]}`}
                  >
                    {STAGE_LABEL[stage]}
                  </span>
                </div>

                {stage === "before" ? (
                  <button
                    type="button"
                    onClick={clockIn}
                    className="mt-4 flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-600 px-5 text-[17px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
                  >
                    <i className="ri-login-circle-line text-[19px]" />
                    출근하기
                  </button>
                ) : null}

                {stage === "working" ? (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={startRest}
                      className="flex min-h-[52px] flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-5 text-[16px] font-semibold text-foreground-900 transition-colors hover:border-primary-400"
                    >
                      <i className="ri-cup-line text-[19px]" />
                      휴게 시작
                    </button>
                    <button
                      type="button"
                      onClick={openClockOut}
                      className="flex min-h-[52px] flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-600 px-5 text-[16px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
                    >
                      <i className="ri-logout-circle-line text-[19px]" />
                      퇴근하기
                    </button>
                  </div>
                ) : null}

                {stage === "resting" ? (
                  <button
                    type="button"
                    onClick={endRest}
                    className="mt-4 flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-accent-500 px-5 text-[17px] font-semibold text-foreground-950 transition-colors hover:bg-accent-600"
                  >
                    <i className="ri-arrow-go-back-line text-[19px]" />
                    복귀하기
                  </button>
                ) : null}

                {stage === "done" ? (
                  <p className="mt-4 flex items-center gap-2 rounded-md bg-background-50 px-4 py-3 text-[16px] font-semibold text-primary-800">
                    <i className="ri-checkbox-circle-line text-[20px]" />
                    오늘 근무를 마쳤어요
                  </p>
                ) : null}

                {confirmOut ? (
                  <div className="mt-3 rounded-md border border-accent-300 bg-accent-50 p-3">
                    <p className="text-[15px] font-semibold text-accent-900">
                      퇴근할까요? 지금 시각으로 기록돼요.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={confirmClockOut}
                        className="flex min-h-[44px] cursor-pointer items-center justify-center whitespace-nowrap rounded-md bg-primary-600 px-5 text-[15px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
                      >
                        퇴근 확인
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmOut(false)}
                        className="flex min-h-[44px] cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-5 text-[15px] font-medium text-foreground-800 transition-colors hover:border-foreground-300"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md border border-background-200 bg-background-50 px-2 py-2.5">
                    <p className="text-[13px] text-foreground-600">출근</p>
                    <p className="tabular mt-0.5 text-[16px] font-semibold text-foreground-950">
                      {clockInAt ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-md border border-background-200 bg-background-50 px-2 py-2.5">
                    <p className="text-[13px] text-foreground-600">휴게</p>
                    <p className="mt-0.5 text-[16px] font-semibold text-foreground-950">
                      {restMinutes > 0 ? `${restMinutes}분` : "—"}
                    </p>
                  </div>
                  <div className="rounded-md border border-background-200 bg-background-50 px-2 py-2.5">
                    <p className="text-[13px] text-foreground-600">퇴근</p>
                    <p className="tabular mt-0.5 text-[16px] font-semibold text-foreground-950">
                      {clockOutAt ?? "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-background-200 bg-background-50 p-4">
                  <p className="flex items-center gap-2 text-[15px] font-semibold text-foreground-900">
                    <i className="ri-calendar-schedule-line text-[17px] text-primary-700" />
                    내 근무표
                  </p>
                  <dl className="mt-3 space-y-2 text-[15px]">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-foreground-600">근무 요일</dt>
                      <dd className="text-foreground-900">{KIM.schedule}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-foreground-600">휴게</dt>
                      <dd className="text-foreground-900">60분</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-[13px] leading-relaxed text-foreground-600">
                    본인 근무표 예시만 보여요.
                  </p>
                </div>

                <div className="rounded-lg border border-background-200 bg-background-50 p-4">
                  <p className="flex items-center gap-2 text-[15px] font-semibold text-foreground-900">
                    <i className="ri-wallet-3-line text-[17px] text-primary-700" />
                    내 급여
                  </p>
                  <dl className="mt-3 space-y-2 text-[15px]">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-foreground-600">근무 시간</dt>
                      <dd className="text-foreground-900">{KIM_PAY?.hours ?? "—"}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-foreground-600">실수령액</dt>
                      <dd className="tabular font-semibold text-foreground-950">{KIM_PAY?.net ?? "—"}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-relaxed text-foreground-600">
                    <i className="ri-information-line mt-0.5 text-[14px]" />
                    급여 확정 전이라 검토용 예시예요.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2 border-t border-background-200 pt-4">
            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground-600">
              <i className="ri-shield-check-line mt-0.5 text-[15px] text-foreground-500" />
              서버 없이 화면에서만 동작하는 시연이에요. 실제 개인정보 입력도, 카메라 요청도 없어요. 다른
              기기에서 열면 서로 별개의 예시로 보여요.
            </p>

            {confirmReset ? (
              <div className="rounded-md border border-accent-300 bg-accent-50 p-3">
                <p className="text-[15px] font-semibold text-accent-900">
                  출근·휴게·퇴근 기록을 지우고 처음으로 되돌릴까요?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={resetDemo}
                    className="flex min-h-[44px] cursor-pointer items-center justify-center whitespace-nowrap rounded-md bg-primary-600 px-5 text-[15px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
                  >
                    초기화
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="flex min-h-[44px] cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-5 text-[15px] font-medium text-foreground-800 transition-colors hover:border-foreground-300"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 whitespace-nowrap text-[14px] font-semibold text-foreground-600 transition-colors hover:text-foreground-900"
              >
                <i className="ri-restart-line text-[16px]" />
                체험 기록 초기화
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}