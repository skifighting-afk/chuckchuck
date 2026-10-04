import Anno from "./Anno";
import ScreenFrame from "./ScreenFrame";
import ScrollHint from "./ScrollHint";
import { DEMO_MONTH, DEMO_PAYROLL, DEMO_PAYROLL_TOTAL } from "@/mocks/site";

export default function PayrollScreen() {
  return (
    <ScreenFrame
      title="급여·명세서"
      meta={DEMO_MONTH}
      action={
        <div className="flex items-center gap-2">
          <Anno n={2} />
          <span className="flex min-h-[48px] items-center rounded-md bg-primary-600 px-4 text-[16px] font-semibold text-background-50">
            급여 확정
          </span>
        </div>
      }
    >
      <div className="rounded-md border border-background-200 bg-background-50 p-5">
        <p className="text-[15px] text-foreground-700">이번 달 급여 합계 (실수령 · 예시)</p>
        <p className="tabular mt-1 font-heading text-[30px] font-bold text-primary-700">
          {DEMO_PAYROLL_TOTAL}
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-foreground-600">
          홈 요약의 &quot;이번 달 예상 급여 266,000원&quot;과 같은 금액이에요. 예시 데이터라 실제 송금은
          없어요.
        </p>
      </div>

      <div className="mb-3 mt-5 flex items-center gap-2">
        <Anno n={1} />
        <p className="text-[15px] font-semibold text-foreground-800">직원별 급여</p>
      </div>

      <ScrollHint />

      <div className="overflow-x-auto rounded-md border border-background-200 bg-background-50">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[110px_repeat(4,minmax(0,1fr))] border-b border-background-200 bg-background-100">
            {["직원", "근무시간", "지급", "공제", "실수령"].map((head) => (
              <div key={head} className="px-3 py-3 text-[15px] font-semibold text-foreground-800">
                {head}
              </div>
            ))}
          </div>
          {DEMO_PAYROLL.map((row) => (
            <div
              key={row.name}
              className="grid grid-cols-[110px_repeat(4,minmax(0,1fr))] items-center border-b border-background-200 last:border-b-0"
            >
              <div className="px-3 py-3 text-[15px] font-semibold text-foreground-900">{row.name}</div>
              <div className="tabular px-3 py-3 text-[15px] text-foreground-800">{row.hours}</div>
              <div className="tabular px-3 py-3 text-[15px] text-foreground-800">{row.pay}</div>
              <div className="tabular px-3 py-3 text-[15px] text-foreground-800">{row.deduct}</div>
              <div className="tabular px-3 py-3 text-[16px] font-bold text-foreground-950">
                {row.net}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-[15px] leading-relaxed text-foreground-600">
        입력한 근무 기록과 수당·공제를 기준으로 정리한 예시예요. 실제 확정 금액과 다를 수 있어요.
      </p>
    </ScreenFrame>
  );
}