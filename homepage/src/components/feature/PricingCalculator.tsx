import { useState } from "react";
import { EXTRA_PER_BRANCH, TERM_DISCOUNTS, monthlyPrice } from "@/mocks/site";

// 운영 앱 lib/plans.ts의 periodPrice와 같은 방식: 월 요금 × 개월 수에서 할인, 10원 단위 버림.
const BRANCHES = Array.from({ length: 10 }, (_, index) => index + 1);
const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;

export default function PricingCalculator() {
  const [plan, setPlan] = useState<"basic" | "pro">("pro");
  const [branches, setBranches] = useState(1);
  const [months, setMonths] = useState(1);
  const monthly = monthlyPrice(plan, branches);
  const rate = TERM_DISCOUNTS.find((t) => t.months === months)?.rate ?? 0;
  const period = Math.floor((monthly * months * (1 - rate)) / 10) * 10;
  const chip = (active: boolean) =>
    `flex min-h-[48px] min-w-[48px] items-center justify-center rounded-md border px-3 text-[17px] font-semibold transition-colors ${
      active
        ? "border-primary-600 bg-primary-600 text-background-50"
        : "border-background-300 bg-background-50 text-foreground-800 hover:border-foreground-300"
    }`;

  return (
    <div className="rounded-lg border border-background-200 bg-background-50 p-6 md:p-7">
      <h3 className="font-heading text-[20px] font-bold text-foreground-950">내 가게 요금 계산</h3>
      <p className="mt-2 text-[16px] leading-relaxed text-foreground-700">
        요금은 지점 수로만 정해지고 직원 수는 상관없어요. 6지점부터는 지점당 월 {won(EXTRA_PER_BRANCH)}이 더해져요.
      </p>

      <p className="mt-5 text-[15px] font-semibold text-foreground-800">요금제</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="요금제 선택">
        {(["basic", "pro"] as const).map((id) => (
          <button key={id} type="button" onClick={() => setPlan(id)} aria-pressed={plan === id} className={chip(plan === id)}>
            {id === "basic" ? "베이직" : "프로 (QR 출퇴근)"}
          </button>
        ))}
      </div>

      <p className="mt-5 text-[15px] font-semibold text-foreground-800">지점 수</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="지점 수 선택">
        {BRANCHES.map((value) => (
          <button key={value} type="button" onClick={() => setBranches(value)} aria-pressed={value === branches} className={chip(value === branches)}>
            {value}곳
          </button>
        ))}
      </div>

      <p className="mt-5 text-[15px] font-semibold text-foreground-800">구독 기간</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="구독 기간 선택">
        {TERM_DISCOUNTS.map((t) => (
          <button key={t.months} type="button" onClick={() => setMonths(t.months)} aria-pressed={t.months === months} className={chip(t.months === months)}>
            {t.months}개월{t.rate ? ` (${t.rate * 100}% 할인)` : ""}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 rounded-md border border-background-200 bg-background-100 p-5 sm:grid-cols-2">
        <div>
          <p className="text-[15px] text-foreground-700">월 요금 ({branches}곳)</p>
          <p className="mt-1 tabular font-heading text-[24px] font-bold text-foreground-950">{won(monthly)}</p>
          <p className="mt-1 text-[15px] text-foreground-600">VAT 포함</p>
        </div>
        <div>
          <p className="text-[15px] text-foreground-700">{months}개월 결제 금액</p>
          <p className="mt-1 tabular font-heading text-[24px] font-bold text-primary-700">{won(period)}</p>
          <p className="mt-1 text-[15px] text-foreground-600">{rate ? `${won(monthly * months - period)} 할인` : "할인 없음"}</p>
        </div>
      </div>

      <p className="mt-4 text-[15px] leading-relaxed text-foreground-700">
        가입 후 30일은 무료예요. 지금은 결제 서비스 연결 전이라 실제 결제는 없어요.
      </p>
    </div>
  );
}
