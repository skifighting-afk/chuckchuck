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
} from "@/mocks/site";

const FREE_BASIC = [
  "직원 직접 가입·합류 신청",
  "근무표",
  "출퇴근 기록",
  "정정 승인",
  "매장 QR 출근 화면",
  "매장 공지 (사전 체험 제공)",
];

const PAID_EXTRA = [
  "급여 마감",
  "근로계약서 (근로조건 작성·양측 서명·사본 다운로드)",
  "휴가 승인 (사전 체험 제공)",
  "인건비 보고서 (사전 체험 제공)",
];

const MULTI_EXTRA = ["여러 가게 통합 비교 (사전 체험 제공)"];

const PRICING_NOTES = [
  {
    icon: "ri-bank-card-line",
    title: "지금은 결제 기능이 없어요",
    body: "카드 입력이나 유료 결제가 이루어지지 않고, 결제 화면도 제공하지 않아요.",
  },
  {
    icon: "ri-shield-check-line",
    title: "체험이 끝나도 자동 결제는 없어요",
    body: "유료 요금제는 14일 동안 한 번 체험할 수 있어요. 체험이 끝나도 자동으로 결제되지 않아요.",
  },
  {
    icon: "ri-price-tag-3-line",
    title: "정식 판매 전에는 바뀔 수 있어요",
    body: "안내된 요금은 판매 준비용 가격이에요. 정식 판매 전에 가격과 조건이 바뀔 수 있어요.",
  },
];

const PRICING_FAQS = [FAQS[2], FAQS[3], FAQS[1], FAQS[6], FAQS[9]];

const CONTRACT_ITEMS = ["근로조건 작성", "양측 확인·서명", "계약서 사본 다운로드"];

export default function Pricing() {
  return (
    <>
      <Seo
        title="이용 요금 | 척척사장봇 요금제"
        description="척척사장봇 요금제는 무료(매장 1곳·직원 3명), 사장님5 월 19,900원, 사장님10 월 29,900원, 여러매장(매장당 월 29,900원)으로 구성됩니다. 무료는 기간 제한 없이, 유료는 14일 동안 한 번 체험할 수 있어요."
        path="/pricing"
        keywords="척척사장봇 요금, 매장 관리 요금, 출퇴근 관리 가격, 소상공인 요금제"
      />
      <PageHero
        label="이용 요금"
        title="가게 규모에 맞춰 고르세요"
        lead="무료 요금제로 시작하고, 필요할 때 유료 요금제를 14일 동안 체험할 수 있어요. 지금은 판매 준비용 가격이고, 실제 결제는 없어요."
        actions={
          <a
            href={EXTERNAL.demo}
            className="flex min-h-[56px] items-center justify-center whitespace-nowrap rounded-md bg-primary-600 px-7 text-[17px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
          >
            무료로 시작하기
          </a>
        }
      />

      <section className="bg-background-50 py-16 md:py-20">
        <Container>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
              무료는 기본, 유료는 계약·급여까지
            </h2>
            <p className="mt-4 text-[18px] leading-relaxed text-foreground-700">
              무료와 유료의 차이를 한눈에 확인하세요. 무료는 기간 제한이 없고, 근로계약서·급여 정리는
              유료 요금제에 포함돼요.
            </p>
          </Reveal>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <Reveal className="rounded-lg border border-background-200 bg-background-50 p-6">
              <h3 className="font-heading text-[20px] font-bold text-foreground-950">
                무료에 포함
              </h3>
              <ul className="mt-4 space-y-3">
                {FREE_BASIC.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[16px] leading-relaxed text-foreground-800">
                    <i className="ri-check-line mt-0.5 flex-none text-[18px] text-primary-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={60} className="rounded-lg border border-primary-300 bg-primary-50/60 p-6">
              <h3 className="font-heading text-[20px] font-bold text-foreground-950">
                유료에서 더해져요
              </h3>
              <ul className="mt-4 space-y-3">
                {PAID_EXTRA.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[16px] leading-relaxed text-foreground-800">
                    <i className="ri-check-line mt-0.5 flex-none text-[18px] text-primary-700" />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={120} className="rounded-lg border border-background-200 bg-background-50 p-6">
              <h3 className="font-heading text-[20px] font-bold text-foreground-950">
                여러매장에서 더해져요
              </h3>
              <ul className="mt-4 space-y-3">
                {MULTI_EXTRA.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[16px] leading-relaxed text-foreground-800">
                    <i className="ri-check-line mt-0.5 flex-none text-[18px] text-primary-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Reveal delay={160} className="mt-5 rounded-lg border border-background-200 bg-background-50 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-md bg-accent-100 text-accent-700">
                <i className="ri-file-text-line text-[22px]" />
              </span>
              <h3 className="font-heading text-[20px] font-bold text-foreground-950">근로계약서</h3>
              <span className="rounded-full bg-secondary-100 px-3 py-1 text-[14px] font-semibold text-secondary-900">
                사장님5 이상 유료 요금제
              </span>
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              {CONTRACT_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[16px] leading-relaxed text-foreground-800">
                  <i className="ri-check-line mt-0.5 flex-none text-[18px] text-accent-600" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[15px] leading-relaxed text-foreground-600">
              근로계약서는 사장님5(월 19,900원)부터 제공돼요. 앱에서 양측 확인·서명과 사본을
              관리해요. 이메일 인증·발송은 연결 준비 중이에요.
            </p>
          </Reveal>
        </Container>
      </section>

      <section className="border-t border-background-200 bg-background-50 py-16 md:py-20">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-14">
            <Reveal>
              <SectionLabel>여러매장 요금 계산</SectionLabel>
              <h2 className="mt-4 font-heading text-[28px] font-bold leading-[1.24] tracking-tight text-foreground-950 md:text-[36px]">
                가게 수를 골라 보세요
              </h2>
              <p className="mt-4 text-[18px] leading-relaxed text-foreground-700">
                2곳부터 10곳까지, 가게 수에 따라 요금을 바로 확인할 수 있어요. 매장당 직원 10명 이하까지
                쓸 수 있어요.
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