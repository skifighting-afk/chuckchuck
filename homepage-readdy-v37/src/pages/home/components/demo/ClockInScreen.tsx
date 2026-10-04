import Anno from "./Anno";
import ScreenFrame from "./ScreenFrame";
import ScrollHint from "./ScrollHint";
import QRStaffDemo from "@/components/feature/QRStaffDemo";
import { DEMO_APPROVAL, DEMO_ATTENDANCE, DEMO_TODAY_SUMMARY, QR_GUIDE } from "@/mocks/site";

const TONE: Record<string, string> = {
  ok: "bg-primary-50 text-primary-800",
  warn: "bg-accent-100 text-accent-900",
};

export default function ClockInScreen() {
  return (
    <ScreenFrame title="출퇴근 기록" meta="오늘 · 9월 23일 수요일 (예시)">
      <div className="space-y-6">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Anno n={1} />
            <p className="text-[15px] font-semibold text-foreground-800">오늘 출근 현황</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {DEMO_TODAY_SUMMARY.map((item) => (
              <div
                key={item.label}
                className="rounded-md border border-background-200 bg-background-50 px-4 py-3.5"
              >
                <p className="text-[15px] text-foreground-700">{item.label}</p>
                <p className="mt-1 font-heading text-[22px] font-bold text-foreground-950">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-accent-200 bg-accent-50 p-4">
          <p className="text-[16px] font-semibold text-accent-900">{QR_GUIDE.title}</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-accent-900/80">{QR_GUIDE.note}</p>
        </div>

        {/* 출퇴근 시연 안에 작은 "직원 출근 체험" — 기본은 접혀 있고 펼치면 QR·직원 화면이 열린다 */}
        <QRStaffDemo />

        <div>
          <p className="mb-2 text-[15px] font-semibold text-foreground-800">출퇴근 기록</p>
          <ScrollHint />

          <div className="hidden overflow-x-auto rounded-md border border-background-200 bg-background-50 sm:block">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_1fr_1.2fr] border-b border-background-200 bg-background-100">
                {["직원", "근무일", "출근", "퇴근", "휴게", "실근무", "관리"].map((head) => (
                  <div key={head} className="px-3 py-3 text-[15px] font-semibold text-foreground-800">
                    {head}
                  </div>
                ))}
              </div>
              {DEMO_ATTENDANCE.map((row) => (
                <div
                  key={row.name}
                  className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_1fr_1.2fr] items-center border-b border-background-200 last:border-b-0"
                >
                  <div className="px-3 py-3 text-[15px] font-semibold text-foreground-900">{row.name}</div>
                  <div className="px-3 py-3 text-[15px] text-foreground-700">{row.day}</div>
                  <div className="tabular px-3 py-3 text-[15px] text-foreground-800">{row.clockIn}</div>
                  <div className="tabular px-3 py-3 text-[15px] text-foreground-800">{row.clockOut}</div>
                  <div className="px-3 py-3 text-[15px] text-foreground-800">{row.rest}</div>
                  <div className="px-3 py-3 text-[15px] text-foreground-800">{row.work}</div>
                  <div className="px-3 py-3">
                    <span className="flex min-h-[40px] items-center justify-center rounded-md border border-background-300 px-2 text-[14px] font-medium text-foreground-800">
                      수정 요청
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 sm:hidden">
            {DEMO_ATTENDANCE.map((row) => (
              <div key={row.name} className="rounded-md border border-background-200 bg-background-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[17px] font-semibold text-foreground-950">{row.name}</span>
                  <span className={`rounded-full px-3 py-1 text-[14px] font-semibold ${TONE[row.tone]}`}>
                    {row.state}
                  </span>
                </div>
                <p className="mt-1 text-[15px] text-foreground-600">{row.day}</p>
                <dl className="mt-3 grid grid-cols-2 gap-y-2 text-[15px]">
                  <dt className="text-foreground-600">출근</dt>
                  <dd className="tabular text-right text-foreground-900">{row.clockIn}</dd>
                  <dt className="text-foreground-600">퇴근</dt>
                  <dd className="tabular text-right text-foreground-900">{row.clockOut}</dd>
                  <dt className="text-foreground-600">휴게</dt>
                  <dd className="text-right text-foreground-900">{row.rest}</dd>
                  <dt className="text-foreground-600">실근무</dt>
                  <dd className="text-right text-foreground-900">{row.work}</dd>
                </dl>
                <span className="mt-4 flex min-h-[48px] items-center justify-center rounded-md border border-background-300 px-4 text-[16px] font-medium text-foreground-800">
                  수정 요청
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <Anno n={2} />
            <p className="text-[15px] font-semibold text-foreground-800">사장님 승인</p>
          </div>
          <div className="rounded-md border border-background-200 bg-background-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[16px] font-semibold text-foreground-950">
                {DEMO_APPROVAL.name} · {DEMO_APPROVAL.day}
              </span>
              <span className="rounded-full bg-secondary-100 px-3 py-1 text-[14px] font-medium text-secondary-900">
                수정 요청
              </span>
            </div>
            <p className="tabular mt-3 text-[16px] text-foreground-800">
              변경 전 {DEMO_APPROVAL.before} → 변경 후 {DEMO_APPROVAL.after}
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-foreground-700">
              사유 · {DEMO_APPROVAL.reason}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="flex min-h-[48px] items-center rounded-md bg-primary-600 px-5 text-[16px] font-semibold text-background-50">
                승인
              </span>
              <span className="flex min-h-[48px] items-center rounded-md border border-background-300 px-5 text-[16px] font-medium text-foreground-800">
                반려
              </span>
              <span className="ml-auto text-[14px] text-foreground-600">변경 이력으로 기록돼요</span>
            </div>
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}