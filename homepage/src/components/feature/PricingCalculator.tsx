import { useState } from "react";
import {
  MULTI_STORE_MAX,
  MULTI_STORE_MIN,
  MULTI_STORE_PRICE_PER_STORE,
} from "@/mocks/site";

const COUNTS = Array.from(
  { length: MULTI_STORE_MAX - MULTI_STORE_MIN + 1 },
  (_, index) => MULTI_STORE_MIN + index,
);

function won(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

export default function PricingCalculator() {
  const [count, setCount] = useState(MULTI_STORE_MIN);
  const base = MULTI_STORE_PRICE_PER_STORE * count;
  const total = Math.round(base * 1.1);

  return (
    <div className="rounded-lg border border-background-200 bg-background-50 p-6 md:p-7">
      <h3 className="font-heading text-[20px] font-bold text-foreground-950">
        가게 수를 골라 보세요
      </h3>
      <p className="mt-2 text-[16px] leading-relaxed text-foreground-700">
        여러매장 요금제는 매장당 월 {MULTI_STORE_PRICE_PER_STORE.toLocaleString("ko-KR")}원(VAT 별도)이고, 2곳부터 10곳까지예요.
      </p>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="가게 수 선택">
        {COUNTS.map((value) => {
          const isActive = value === count;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setCount(value)}
              aria-pressed={isActive}
              className={`flex min-h-[48px] min-w-[48px] items-center justify-center rounded-md border px-3 text-[17px] font-semibold transition-colors ${
                isActive
                  ? "border-primary-600 bg-primary-600 text-background-50"
                  : "border-background-300 bg-background-50 text-foreground-800 hover:border-foreground-300"
              }`}
            >
              {value}곳
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 rounded-md border border-background-200 bg-background-100 p-5 sm:grid-cols-2">
        <div>
          <p className="text-[15px] text-foreground-700">월 구독료 ({count}곳)</p>
          <p className="mt-1 tabular font-heading text-[24px] font-bold text-foreground-950">
            {won(base)}
          </p>
          <p className="mt-1 text-[15px] text-foreground-600">VAT 별도</p>
        </div>
        <div>
          <p className="text-[15px] text-foreground-700">합계 (VAT 포함)</p>
          <p className="mt-1 tabular font-heading text-[24px] font-bold text-primary-700">
            {won(total)}
          </p>
          <p className="mt-1 text-[15px] text-foreground-600">{count}곳 기준</p>
        </div>
      </div>

      <p className="mt-4 text-[15px] leading-relaxed text-foreground-700">
        지금은 판매 준비용 가격이에요. 실제 결제와 자동 결제는 없어요.
      </p>
    </div>
  );
}