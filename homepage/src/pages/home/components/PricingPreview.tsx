import { Link } from "react-router-dom";
import Container from "@/components/base/Container";
import Reveal from "@/components/base/Reveal";
import SectionLabel from "@/components/base/SectionLabel";
import PlanCard from "@/components/feature/PlanCard";
import { PLANS, PRICING_DISCLAIMER } from "@/mocks/site";

export default function PricingPreview() {
  return (
    <section className="border-t border-background-200 bg-background-50 py-16 md:py-24">
      <Container>
        <Reveal className="max-w-2xl">
          <SectionLabel>이용 요금</SectionLabel>
          <h2 className="mt-4 font-heading text-[30px] font-bold leading-[1.22] tracking-tight text-foreground-950 md:text-[42px]">
            가게 규모에 맞춰 고르세요
          </h2>
          <p className="mt-4 text-[18px] leading-relaxed text-foreground-700">
            베이직과 프로 두 가지예요. 직원 수 제한 없이 지점 수로만 요금이 정해지고, 가입 후 30일은 무료예요.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-[16px] leading-relaxed text-foreground-700">
            {PRICING_DISCLAIMER}
          </p>
          <Link
            to="/pricing"
            className="inline-flex min-h-[56px] items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-6 text-[17px] font-medium text-foreground-900 transition-colors hover:border-foreground-300"
          >
            요금 자세히 보기
            <i className="ri-arrow-right-line text-[18px]" />
          </Link>
        </div>
      </Container>
    </section>
  );
}