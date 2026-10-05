import Container from "@/components/base/Container";
import Reveal from "@/components/base/Reveal";
import TrialNote from "@/components/base/TrialNote";
import Cheokcheoki from "@/components/base/Cheokcheoki";
import { EXTERNAL } from "@/mocks/site";

export default function FinalCta() {
  return (
    <section className="bg-primary-950 py-16 text-background-50 md:py-24">
      <Container>
        <Reveal className="mx-auto max-w-3xl text-center">
          <div className="char-in mb-6 flex justify-center">
            <div className="char-breath h-[120px] w-[120px]">
              <Cheokcheoki />
            </div>
          </div>
          <span className="text-[15px] font-semibold text-accent-300">
            무료로 시작하고, 카드 등록 없이
          </span>
          <h2 className="mt-5 font-heading text-[32px] font-bold leading-[1.2] tracking-tight sm:text-[42px] md:text-[50px]">
            오늘 가게의 하루부터,
            <br />
            척척 맡겨보세요.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[18px] leading-relaxed text-background-100">
            직원 출근부터 월급 정리까지. 척척사장이 사장님의 할 일을 한곳에 모아 가게의 흐름을
            정리해 드려요.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={EXTERNAL.demo}
              className="flex min-h-[60px] w-full items-center justify-center whitespace-nowrap rounded-md bg-accent-400 px-8 text-[18px] font-semibold text-foreground-950 transition-colors hover:bg-accent-300 sm:w-auto"
            >
              무료로 시작하기
            </a>
            <a
              href={EXTERNAL.appStart}
              className="flex min-h-[60px] w-full items-center justify-center whitespace-nowrap rounded-md border border-background-50/40 px-8 text-[18px] font-medium text-background-50 transition-colors hover:bg-background-50/10 sm:w-auto"
            >
              내 가게 열기
            </a>
          </div>

          <div className="mt-6 flex justify-center">
            <TrialNote tone="dark" className="max-w-md text-left" />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}