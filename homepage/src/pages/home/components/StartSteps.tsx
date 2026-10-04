import { Link } from "react-router-dom";
import Container from "@/components/base/Container";
import Reveal from "@/components/base/Reveal";
import SectionLabel from "@/components/base/SectionLabel";
import BrandMotion from "@/components/feature/BrandMotion";
import { START_STEPS } from "@/mocks/site";

export default function StartSteps() {
  return (
    <section className="border-t border-background-200 bg-background-100 py-16 md:py-24">
      <Container>
        <Reveal className="max-w-2xl">
          <SectionLabel>어떻게 시작하나요</SectionLabel>
          <h2 className="mt-4 font-heading text-[30px] font-bold leading-[1.22] tracking-tight text-foreground-950 md:text-[42px]">
            세 가지만 하면 돼요
          </h2>
          <p className="mt-4 text-[18px] leading-relaxed text-foreground-700">
            먼저 화면을 둘러보고, 내 가게를 만들고, 직원과 연결하면 돼요.
          </p>
        </Reveal>

        <BrandMotion className="relative mt-12 grid gap-6 md:grid-cols-3">
          <span
            aria-hidden="true"
            className="absolute left-0 right-0 top-[52px] hidden h-[2px] overflow-hidden bg-background-300 md:block"
          >
            <span className="bm-flow-line block h-full w-full origin-left bg-primary-400/70" />
          </span>
          {START_STEPS.map((item) => (
            <div
              key={item.step}
              className="rounded-lg border border-background-200 bg-background-50 p-6 md:p-7"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-primary-600 font-heading text-[20px] font-bold text-background-50">
                  {item.step}
                </span>
                <i className={`${item.icon} text-[26px] text-primary-700`} />
              </div>
              <h3 className="mt-5 font-heading text-[22px] font-bold text-foreground-950">
                {item.title}
              </h3>
              <p className="mt-2.5 text-[16px] leading-relaxed text-foreground-700">{item.body}</p>
            </div>
          ))}
        </BrandMotion>

        <Reveal className="mt-10">
          <Link
            to="/guide"
            className="flex min-h-[56px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-6 text-[17px] font-medium text-foreground-900 transition-colors hover:border-foreground-300 sm:w-auto sm:px-8"
          >
            시작 안내 자세히 보기
            <i className="ri-arrow-right-line text-[18px]" />
          </Link>
        </Reveal>
      </Container>
    </section>
  );
}