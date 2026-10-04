import Container from "@/components/base/Container";
import Reveal from "@/components/base/Reveal";
import SectionLabel from "@/components/base/SectionLabel";
import FaqAccordion from "@/components/feature/FaqAccordion";
import { FAQS } from "@/mocks/site";

export default function FaqSection() {
  return (
    <section className="border-t border-background-200 bg-background-100 py-16 md:py-24">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <Reveal>
            <SectionLabel>자주 묻는 질문</SectionLabel>
            <h2 className="mt-4 font-heading text-[30px] font-bold leading-[1.22] tracking-tight text-foreground-950 md:text-[40px]">
              궁금한 점을 먼저 확인하세요
            </h2>
            <p className="mt-4 text-[18px] leading-relaxed text-foreground-700">
              지금 준비 단계에서 자주 나오는 질문을 사실대로 정리했어요.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <FaqAccordion items={FAQS} />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}