import { Link } from "react-router-dom";
import Container from "@/components/base/Container";
import Reveal from "@/components/base/Reveal";
import SectionLabel from "@/components/base/SectionLabel";
import Seo from "@/components/base/Seo";
import PageHero from "@/components/feature/PageHero";
import BrandExperience, { DemoStage } from "@/pages/home/components/BrandExperience";
import BrandFilm from "@/components/feature/BrandFilm";
import FinalCta from "@/pages/home/components/FinalCta";
import { CAPABILITIES, CONTRACT_DRAFT, EXTERNAL, MANAGER_DELEGATION, NOT_INCLUDED, QR_GUIDE, ROADMAP } from "@/mocks/site";

export default function Product() {
  return (
    <>
      <Seo
        title="어떻게 쓰나요 | 척척사장봇 매장 운영 기능"
        description="척척사장봇이 제공하는 기능을 사실대로 소개합니다. 화면 먼저 체험한 뒤, 직원 연결, 출퇴근·휴게 기록, 정정 승인, 근무표, 매장 QR, 급여 정리, 명세서와 근로조건 문서 기록을 확인하세요."
        path="/product"
        keywords="척척사장봇 사용법, 매장 출퇴근 관리, 근무표, 급여 정리, 직원 관리"
      />
      <PageHero
        label="어떻게 쓰나요"
        title="직원 출근부터 급여까지, 한 흐름으로"
        lead="척척사장봇은 가게의 하루를 이루는 기록을 한곳에 모아요. 지금 사전 체험에서 쓸 수 있는 기능을 정확하게 알려드려요."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={EXTERNAL.demo}
              className="flex min-h-[56px] items-center justify-center whitespace-nowrap rounded-md bg-primary-600 px-7 text-[17px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
            >
              무료로 시작하기
            </a>
            <Link
              to="/guide"
              className="flex min-h-[56px] items-center justify-center whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-7 text-[17px] font-medium text-foreground-900 transition-colors hover:border-foreground-300"
            >
              시작 안내 보기
            </Link>
          </div>
        }
      />

      <BrandExperience />

      <BrandFilm />

      <section className="bg-background-50 py-16 md:py-24">
        <Container>
          <Reveal className="max-w-2xl">
            <SectionLabel>지금 쓸 수 있어요</SectionLabel>
            <h2 className="mt-4 font-heading text-[28px] font-bold leading-[1.24] tracking-tight text-foreground-950 md:text-[38px]">
              지금 실제로 쓸 수 있는 기능
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-background-200 bg-background-200 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((item, index) => (
              <Reveal
                key={item.name}
                delay={index * 30}
                className="flex items-start gap-4 bg-background-50 p-6"
              >
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-md bg-primary-50 text-primary-700">
                  <i className={`${item.icon} text-[22px]`} />
                </span>
                <p className="pt-1.5 text-[17px] leading-relaxed text-foreground-800">{item.name}</p>
              </Reveal>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-background-200 bg-background-100 p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-secondary-100 text-secondary-900">
                  <i className="ri-shield-user-line text-[20px]" />
                </span>
                <h3 className="font-heading text-[18px] font-bold text-foreground-950">
                  {MANAGER_DELEGATION.title}
                </h3>
              </div>
              <p className="mt-3 text-[16px] leading-relaxed text-foreground-700">
                {MANAGER_DELEGATION.body}
              </p>
              <p className="mt-2.5 text-[15px] leading-relaxed text-foreground-600">
                {MANAGER_DELEGATION.notes.join(" ")}
              </p>
              <p className="mt-2.5 text-[15px] font-medium leading-relaxed text-foreground-800">
                {MANAGER_DELEGATION.ownerOnly}
              </p>
            </div>

            <div className="rounded-lg border border-background-200 bg-background-100 p-5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-secondary-100 text-secondary-900">
                  <i className="ri-file-text-line text-[20px]" />
                </span>
                <h3 className="font-heading text-[18px] font-bold text-foreground-950">
                  근로계약서 작성·양측 서명
                </h3>
                <span className="rounded-full border border-accent-300 bg-accent-100 px-2.5 py-0.5 text-[13px] font-semibold text-accent-900">
                  모든 요금제
                </span>
              </div>
              <ol className="mt-3 space-y-1.5 text-[16px] leading-relaxed text-foreground-700">
                {CONTRACT_DRAFT.steps.map((step) => (
                  <li key={step} className="flex items-center gap-2">
                    <i className="ri-check-line text-[16px] text-primary-700" />
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-2.5 text-[15px] leading-relaxed text-foreground-600">
                {CONTRACT_DRAFT.note}
              </p>
              <p className="mt-2.5 text-[15px] leading-relaxed text-foreground-700">
                {CONTRACT_DRAFT.signupNote}
              </p>
              <a
                href={CONTRACT_DRAFT.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-medium text-primary-700 transition-colors hover:text-primary-800"
              >
                {CONTRACT_DRAFT.sourceLabel}
                <i className="ri-external-link-line text-[16px]" />
              </a>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-t border-background-200 bg-background-100 py-16 md:py-24">
        <Container>
          <Reveal className="max-w-3xl">
            <span className="inline-flex rounded-full bg-accent-100 px-4 py-1.5 text-[15px] font-semibold text-accent-900">
              매장 QR 출근
            </span>
            <h2 className="mt-5 font-heading text-[26px] font-bold leading-[1.26] tracking-tight text-foreground-950 md:text-[34px]">
              {QR_GUIDE.title}
            </h2>
            <p className="mt-4 text-[18px] leading-relaxed text-foreground-700">{QR_GUIDE.note}</p>
          </Reveal>
        </Container>
      </section>

      <section className="border-t border-background-200 bg-background-50 py-16 md:py-24">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr] lg:items-center lg:gap-14">
            <Reveal className="min-w-0">
              <SectionLabel>여러 가게 비교</SectionLabel>
              <h2 className="mt-4 font-heading text-[26px] font-bold leading-[1.26] tracking-tight text-foreground-950 md:text-[34px]">
                가게가 여러 곳이어도 한 번에 봐요
              </h2>
              <p className="mt-4 text-[18px] leading-relaxed text-foreground-700">
                매장 관리·비교에서 달을 고르면 가게별 직원 수, 실근무 시간, 인건비, 퇴근 확인 건수를
                나란히 볼 수 있어요. “이 매장 열기”를 누르면 그 가게로 바로 전환돼요.
              </p>
              <p className="mt-4 text-[16px] leading-relaxed text-foreground-600">
                여러 가게 비교는 지점이 2곳 이상인 모든 요금제에서 쓸 수 있어요. 매출이 연결되어
                있지 않아 매출이나 이익률은 보여주지 않아요.
              </p>
            </Reveal>
            <Reveal delay={80} className="min-w-0">
              <DemoStage initialMenu="매장 관리·비교" />
            </Reveal>
          </div>
        </Container>
      </section>

      <section className="border-t border-background-200 bg-background-100 py-16 md:py-24">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
            <Reveal className="min-w-0">
              <SectionLabel>지금은 제공하지 않아요</SectionLabel>
              <h2 className="mt-4 font-heading text-[26px] font-bold leading-[1.26] tracking-tight text-foreground-950 md:text-[34px]">
                없는 기능을 있는 것처럼 말하지 않아요
              </h2>
              <p className="mt-4 text-[18px] leading-relaxed text-foreground-700">
                아래 기능은 지금 제공하지 않아요. 준비가 끝나면 따로 안내할게요.
              </p>
            </Reveal>

            <Reveal delay={80} className="min-w-0">
              <ul className="overflow-hidden rounded-lg border border-background-200 bg-background-50">
                {NOT_INCLUDED.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 border-b border-background-200 px-5 py-4 text-[16px] text-foreground-700 last:border-b-0"
                  >
                    <i className="ri-close-line text-[18px] text-foreground-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </Container>
      </section>

      <section className="border-t border-background-200 bg-background-50 py-16 md:py-24">
        <Container>
          <Reveal className="max-w-2xl">
            <SectionLabel>사전 체험 제공</SectionLabel>
            <h2 className="mt-4 font-heading text-[26px] font-bold leading-[1.26] tracking-tight text-foreground-950 md:text-[34px]">
              지금 사전 체험에서 쓸 수 있어요
            </h2>
            <p className="mt-4 text-[18px] leading-relaxed text-foreground-700">
              아래 기능은 사전 체험에서 화면으로 먼저 볼 수 있어요. 내 가게에 저장할 때만 로그인하면
              돼요.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROADMAP.map((item, index) => (
              <Reveal
                key={item.name}
                delay={index * 50}
                className="rounded-lg border border-background-200 bg-background-50 p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-md bg-secondary-100 text-secondary-900">
                    <i className={`${item.icon} text-[22px]`} />
                  </span>
                  <span className="rounded-full border border-background-300 px-2.5 py-0.5 text-[14px] text-foreground-600">
                    사전 체험 제공
                  </span>
                </div>
                <p className="mt-4 font-heading text-[17px] font-semibold text-foreground-950">
                  {item.name}
                </p>
                {item.note ? (
                  <p className="mt-2 text-[15px] leading-relaxed text-foreground-600">{item.note}</p>
                ) : null}
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}