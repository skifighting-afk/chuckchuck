import Container from "@/components/base/Container";
import Reveal from "@/components/base/Reveal";
import SectionLabel from "@/components/base/SectionLabel";
import Seo from "@/components/base/Seo";
import PageHero from "@/components/feature/PageHero";
import PlanCard from "@/components/feature/PlanCard";
import PricingCalculator from "@/components/feature/PricingCalculator";
import FaqAccordion from "@/components/feature/FaqAccordion";
import FinalCta from "@/pages/home/components/FinalCta";
import {
  EXTERNAL,
  FAQS,
  PLANS,
  PRICING_DISCLAIMER,
  PRICING_LIMIT_NOTE,
  PRICING_VAT_NOTE,
  monthlyPrice,
} from "@/mocks/site";

const COMPARE: [string, string, string][] = [
  ["직원 수", "제한 없음", "제한 없음"],
  ["근무표 · 대타·교대 요청", "포함", "포함"],
  ["출퇴근 기록 · 정정 승인", "앱 버튼으로 기록", "앱 버튼 + 매장 QR"],
  ["매장 QR 출퇴근 (30초마다 바뀌는 QR)", "—", "포함"],
  ["급여 계산 · 임금명세서 · 임금대장", "포함", "포함"],
  ["전자근로계약서", "월 1장 무료 · 추가 3,000원", "월 1장 무료 · 추가 3,000원"],
  ["휴가 · 공지 · 매장 매뉴얼", "포함", "포함"],
  ["여러 지점 비교", "지점 2곳 이상", "지점 2곳 이상"],
];

const TIER_ROWS: [string, number][] = [["1지점", 1], ["2~3지점", 3], ["4~5지점", 5]];

const PRICING_NOTES = [
  {
    icon: "ri-bank-card-line",
    title: "지금은 결제 기능이 없어요",
    body: "카드 입력이나 유료 결제가 이루어지지 않고, 결제 화면도 제공하지 않아요.",
  },
  {
    icon: "ri-shield-check-line",
    title: "체험이 끝나도 자동 결제는 없어요",
    body: "가입 후 30일 동안 프로 기능까지 무료예요. 체험이 끝나도 자동으로 결제되지 않고, 기록 조회와 내려받기는 계속돼요.",
  },
  {
    icon: "ri-price-tag-3-line",
    title: "정식 판매 전에는 바뀔 수 있어요",
    body: "안내된 요금은 판매 준비용 가격이에요. 정식 판매 전에 가격과 조건이 바뀔 수 있어요.",
  },
];

const PRICING_FAQS = [FAQS[1], FAQS[2], FAQS[8], FAQS[6], FAQS[9]];

const CONTRACT_ITEMS = ["근로조건 작성", "양측 확인·서명", "계약서 사본 다운로드"];

export default function Pricing() {
  return (
    <>
      <Seo
        title="이용 요금 | 척척사장봇 요금제"
        description="척척사장봇 요금제는 베이직(1지점 월 9,900원부터)과 프로(QR 출퇴근 포함, 1지점 월 14,900원부터) 두 가지예요. 모든 금액 VAT 포함, 직원 수 제한 없음, 가입 후 30일 무료."
        path="/pricing"
        keywords="척척사장봇 요금, 매장 관리 요금, 출퇴근 관리 가격, 소상공인 요금제"
      />
      <PageHero
        label="이용 요금"
        title="가게 규모에 맞춰 고르세요"
        lead="베이직과 프로 두 가지예요. 직원 수 제한 없이 지점 수로만 요금이 정해지고, 가입 후 30일은 카드 등록 없이 무료예요."
        actions={
          <a
            href={EXTERNAL.demo}
            className="flex min-h-[56px] items-center justify-center whitespace-nowrap rounded-md bg-primary-600 px-7 text-[17px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
          >
            30일 무료로 시작하기
          </a>
        }
      />

      <section className="bg-background-50 py-16 md:py-20">
        <Container>
          <div className="grid gap-5 md:grid-cols-2">
            {PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>

          <Reveal className="mt-8 space-y-2">
            <p className="text-[16px] leading-relaxed text-foreground-700">{PRICING_VAT_NOTE}</p>
            <p className="text-[15px] leading-relaxed text-foreground-600">{PRICING_LIMIT_NOTE}</p>
            <p className="text-[16px] leading-relaxed text-foreground-700">{PRICING_DISCLAIMER}</p>
          </Reveal>
        </Container>
      </section>

      <section className="border-t border-background-200 bg-background-100 py-16 md:py-20">
        <Container>
          <Reveal className="max-w-2xl">
            <SectionLabel>무엇이 다른가요</SectionLabel>
            <h2 className="mt-4 font-heading text-[28px] font-bold leading-[1.24] tracking-tight text-foreground-950 md:text-[36px]">
              차이는 매장 QR 출퇴근 하나예요
            </h2>
            <p className="mt-4 text-[18px] leading-relaxed text-foreground-700">
              급여·계약·근무표는 두 요금제 모두 같아요. 직원이 매장에 와서 QR을 찍어야 출퇴근이 기록되게 하고 싶다면 프로를 고르세요.
            </p>
          </Reveal>

          <Reveal delay={60} className="mt-8 overflow-x-auto rounded-lg border border-background-200 bg-background-50">
            <table className="w-full min-w-[560px] text-left text-[16px]">
              <thead className="bg-background-100 text-foreground-900">
                <tr>
                  <th scope="col" className="px-5 py-4 font-semibold">기능</th>
                  <th scope="col" className="px-5 py-4 font-semibold">베이직</th>
                  <th scope="col" className="px-5 py-4 font-semibold">프로</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([name, basic, pro]) => (
                  <tr key={name} className="border-t border-background-200">
                    <th scope="row" className="px-5 py-4 font-medium text-foreground-900">{name}</th>
                    <td className="px-5 py-4 text-foreground-700">{basic}</td>
                    <td className="px-5 py-4 text-foreground-700">{pro}</td>
                  </tr>
                ))}
                {TIER_ROWS.map(([label, n]) => (
                  <tr key={label} className="border-t border-background-200 bg-background-100/60">
                    <th scope="row" className="px-5 py-4 font-medium text-foreground-900">월 요금 · {label}</th>
                    <td className="tabular px-5 py-4 text-foreground-900">{monthlyPrice("basic", n).toLocaleString("ko-KR")}원</td>
                    <td className="tabular px-5 py-4 text-foreground-900">{monthlyPrice("pro", n).toLocaleString("ko-KR")}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </Container>
      </section>

      <section className="border-t border-background-200 bg-background-50 py-16 md:py-20">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-14">
            <Reveal>
              <SectionLabel>요금 계산</SectionLabel>
              <h2 className="mt-4 font-heading text-[28px] font-bold leading-[1.24] tracking-tight text-foreground-950 md:text-[36px]">
                내 가게는 얼마일까요
              </h2>
              <p className="mt-4 text-[18px] leading-relaxed text-foreground-700">
                요금제, 지점 수, 구독 기간을 고르면 결제 금액을 바로 보여 드려요. 6개월은 10%, 12개월은 20% 할인돼요.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <PricingCalculator />
            </Reveal>
          </div>
        </Container>
      </section>

      <section className="border-t border-background-200 bg-background-100 py-16 md:py-20">
        <Container>
          <Reveal className="max-w-2xl">
            <SectionLabel>결제 전에 알아두세요</SectionLabel>
            <h2 className="mt-4 font-heading text-[28px] font-bold leading-[1.24] tracking-tight text-foreground-950 md:text-[36px]">
              결제 전에 확인하세요
            </h2>
          </Reveal>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PRICING_NOTES.map((note, index) => (
              <Reveal
                key={note.title}
                delay={index * 60}
                className="rounded-lg border border-background-200 bg-background-50 p-6"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary-50 text-primary-700">
                  <i className={`${note.icon} text-[22px]`} />
                </span>
                <p className="mt-4 font-heading text-[18px] font-semibold text-foreground-950">
                  {note.title}
                </p>
                <p className="mt-2 text-[16px] leading-relaxed text-foreground-700">{note.body}</p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-background-200 bg-background-50 py-16 md:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
            <Reveal>
              <SectionLabel>요금 관련 질문</SectionLabel>
              <h2 className="mt-4 font-heading text-[26px] font-bold leading-[1.26] tracking-tight text-foreground-950 md:text-[32px]">
                결제와 체험에 대해
              </h2>
            </Reveal>
            <Reveal delay={80}>
              <FaqAccordion items={PRICING_FAQS} />
            </Reveal>
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}