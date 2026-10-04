import Container from "@/components/base/Container";
import Reveal from "@/components/base/Reveal";
import SectionLabel from "@/components/base/SectionLabel";
import TrialNote from "@/components/base/TrialNote";
import CheokcheokiGreeting from "@/components/feature/CheokcheokiGreeting";
import { BRAND, EXTERNAL, HERO } from "@/mocks/site";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-background-50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-gradient-to-b from-background-100 to-background-50"
      />
      <Container>
        <div className="relative grid gap-10 pb-16 pt-14 md:pb-24 md:pt-24 lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-7">
            <Reveal>
              <SectionLabel>{BRAND.tagline}</SectionLabel>
            </Reveal>
            <Reveal delay={60}>
              <h1 className="mt-6 font-heading text-[32px] font-bold leading-[1.18] tracking-tight text-foreground-950 sm:text-[44px] lg:text-[56px]">
                직원 출근부터 월급 정리까지,
                <br />
                척척.
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-foreground-700 md:text-[20px]">
                {HERO.description}
              </p>
            </Reveal>
            <Reveal delay={180}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={EXTERNAL.demo}
                  className="flex min-h-[60px] items-center justify-center whitespace-nowrap rounded-md bg-primary-600 px-8 text-[18px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
                >
                  무료로 시작하기
                </a>
                <a
                  href={EXTERNAL.appStart}
                  className="flex min-h-[60px] items-center justify-center whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-8 text-[18px] font-medium text-foreground-900 transition-colors hover:border-foreground-300"
                >
                  내 가게 열기
                </a>
              </div>
            </Reveal>
            <Reveal delay={220}>
              <TrialNote className="mt-6 max-w-xl" />
            </Reveal>
          </div>

          <div className="lg:col-span-5">
            <CheokcheokiGreeting />
          </div>
        </div>
      </Container>
    </section>
  );
}