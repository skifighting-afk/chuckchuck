import Container from "@/components/base/Container";
import Reveal from "@/components/base/Reveal";
import SectionLabel from "@/components/base/SectionLabel";
import Seo from "@/components/base/Seo";
import PageHero from "@/components/feature/PageHero";
import FaqAccordion from "@/components/feature/FaqAccordion";
import QRStaffDemo from "@/components/feature/QRStaffDemo";
import FinalCta from "@/pages/home/components/FinalCta";
import { EMPLOYEE_JOIN_FLOW, EMPLOYEE_JOIN_NOTES, EXTERNAL, FAQS, QR_GUIDE, ROLE_ENTRIES, ROLE_ENTRY_NOTES, START_STEPS, TRIAL_NOTE } from "@/mocks/site";

const ENTRY_LINKS = [
  ...ROLE_ENTRIES.flatMap((entry) =>
    entry.actions.map((action) => ({
      label: action.label,
      href: action.href,
      icon: entry.icon,
      host: action.href.replace(/^https?:\/\//, ""),
    }))
  ),
  {
    label: "사장님 신청 관리",
    href: EXTERNAL.staffRequests,
    icon: "ri-user-follow-line",
    host: EXTERNAL.staffRequests.replace(/^https?:\/\//, ""),
  },
];

const CHECKLIST = [
  { icon: "ri-smartphone-line", title: "휴대폰이면 충분해요", body: "앱 설치 없이 브라우저로 열어요. 화면은 로그인 없이 먼저 눌러 볼 수 있어요." },
  { icon: "ri-store-3-line", title: "가게 이름", body: "가게 이름 같은 기본 정보는 실제 등록 단계에서 입력해요." },
  { icon: "ri-team-line", title: "직원 정보", body: "직원 정보는 가게를 만든 뒤 연결 단계에서 입력해요. 미리 준비하지 않아도 돼요." },
];

export default function Guide() {
  return (
    <>
      <Seo
        title="시작 방법 | 척척사장봇 시작 안내"
        description="화면 먼저 체험하고, 사장님은 이메일로 가입해 내 가게를 만든 뒤, 직원은 이메일 가입 후 합류를 신청하고 사장님이 수락하는 순서를 안내해요. 매장 QR은 출근·퇴근 때 스캔하는 방식이에요."
        path="/guide"
        keywords="척척사장봇 시작 방법, 내 가게 만들기, 직원 연결, 매장 QR 출근, 사용 시작"
      />
      <PageHero
        label="시작 방법"
        title="세 단계면 준비 끝"
        lead="화면을 먼저 눌러 보고, 사장님은 이메일로 가입해 가게를 만들고, 직원은 이메일로 가입해 합류를 신청해요. 각자 맞는 로그인 화면으로 들어가요."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={EXTERNAL.demo}
              className="flex min-h-[56px] items-center justify-center whitespace-nowrap rounded-md bg-primary-600 px-7 text-[17px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
            >
              무료로 시작하기
            </a>
            <a
              href={EXTERNAL.appStart}
              className="flex min-h-[56px] items-center justify-center whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-7 text-[17px] font-medium text-foreground-900 transition-colors hover:border-foreground-300"
            >
              내 가게 열기
            </a>
          </div>
        }
      />

      <section className="bg-background-50 py-16 md:py-24">
        <Container>
          <div className="relative">
            <span
              aria-hidden="true"
              className="absolute left-[31px] top-6 hidden h-[calc(100%-4rem)] w-[2px] bg-background-200 md:block"
            />
            <div className="space-y-8 md:space-y-12">
              {START_STEPS.map((step, index) => (
                <Reveal
                  key={step.step}
                  delay={index * 60}
                  className="relative grid gap-5 md:grid-cols-[64px_1fr] md:gap-8"
                >
                  <span className="z-10 flex h-16 w-16 items-center justify-center rounded-full border border-background-200 bg-background-50 font-heading text-[22px] font-bold text-primary-700">
                    {step.step}
                  </span>
                  <div className="md:pt-2">
                    <div className="flex items-center gap-3">
                      <i className={`${step.icon} text-[24px] text-primary-600`} />
                      <h2 className="font-heading text-[24px] font-bold tracking-tight text-foreground-950 md:text-[28px]">
                        {step.title}
                      </h2>
                    </div>
                    <p className="mt-3 max-w-2xl text-[18px] leading-relaxed text-foreground-700">
                      {step.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="border-t border-background-200 bg-background-100 py-16 md:py-20">
        <Container>
          <Reveal className="max-w-3xl rounded-lg border border-accent-300 bg-accent-50 p-6 md:p-7">
            <span className="inline-flex rounded-full bg-accent-200 px-4 py-1.5 text-[15px] font-semibold text-accent-900">
              매장 QR 출근
            </span>
            <h2 className="mt-4 font-heading text-[24px] font-bold leading-[1.28] tracking-tight text-accent-950 md:text-[30px]">
              {QR_GUIDE.title}
            </h2>
            <p className="mt-3 text-[17px] leading-relaxed text-accent-900">{QR_GUIDE.note}</p>
          </Reveal>

          {/* 같은 QR 출근 체험 컴포넌트를 가이드에서도 재사용한다 */}
          <div className="mt-8 max-w-3xl">
            <QRStaffDemo />
          </div>

          <Reveal className="mt-10 max-w-2xl">
            <SectionLabel>준비물</SectionLabel>
            <h2 className="mt-4 font-heading text-[26px] font-bold leading-[1.26] tracking-tight text-foreground-950 md:text-[34px]">
              시작 전에 챙기면 좋아요
            </h2>
          </Reveal>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {CHECKLIST.map((item, index) => (
              <Reveal
                key={item.title}
                delay={index * 60}
                className="rounded-lg border border-background-200 bg-background-50 p-6"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-md bg-background-100 text-primary-700">
                  <i className={`${item.icon} text-[24px]`} />
                </span>
                <p className="mt-4 font-heading text-[18px] font-semibold text-foreground-950">
                  {item.title}
                </p>
                <p className="mt-2 text-[16px] leading-relaxed text-foreground-700">{item.body}</p>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-6">
            <div className="flex flex-col gap-2 rounded-lg border border-background-200 bg-background-50 p-5 sm:flex-row sm:items-center sm:gap-3">
              <i className="ri-information-line text-[22px] text-primary-700" />
              <p className="text-[17px] leading-relaxed text-foreground-800">{TRIAL_NOTE}</p>
            </div>
          </Reveal>
        </Container>
      </section>

      <section className="border-t border-background-200 bg-background-50 py-16 md:py-20">
        <Container>
          <Reveal className="max-w-2xl">
            <SectionLabel>시작 경로</SectionLabel>
            <h2 className="mt-4 font-heading text-[26px] font-bold leading-[1.26] tracking-tight text-foreground-950 md:text-[34px]">
              사장님은 가게를 만들고, 직원은 직접 신청
            </h2>
            <p className="mt-4 text-[18px] leading-relaxed text-foreground-700">
              사장님은 이메일로 가입해 가게를 만들고, 직원 가입 신청 관리에서 매장별 조건을 설정해 수락해요. 직원은 이메일로 계정을 만들고 가게 코드를 넣어 합류를 신청하고, 사장님이 수락하면 연결돼요. 역할마다 들어가는 로그인 화면이 달라요.
            </p>
          </Reveal>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {EMPLOYEE_JOIN_FLOW.map((item, index) => (
              <Reveal
                key={item.step}
                delay={index * 60}
                className="rounded-lg border border-background-200 bg-background-100 p-6"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-md bg-background-50 text-primary-700">
                  <i className={`${item.icon} text-[24px]`} />
                </span>
                <p className="mt-4 font-heading text-[18px] font-semibold text-foreground-950">
                  {item.title}
                </p>
                <p className="mt-2 text-[16px] leading-relaxed text-foreground-700">{item.body}</p>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-6 space-y-2">
            {EMPLOYEE_JOIN_NOTES.map((note) => (
              <p
                key={note}
                className="flex items-start gap-2 text-[16px] leading-relaxed text-foreground-700"
              >
                <i className="ri-information-line mt-0.5 flex-none text-[17px] text-primary-700" />
                {note}
              </p>
            ))}
          </Reveal>

          <Reveal className="mt-6 grid gap-3 sm:grid-cols-2">
            {ENTRY_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-lg border border-background-200 bg-background-100 p-4 transition-colors hover:border-primary-300"
              >
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-md bg-primary-50 text-primary-700">
                  <i className={`${link.icon} text-[22px]`} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-foreground-950">
                    {link.label}
                  </span>
                  <span className="block truncate text-[14px] text-foreground-600">
                    {link.host}
                  </span>
                </span>
              </a>
            ))}
          </Reveal>

          <Reveal className="mt-6 space-y-2">
            {ROLE_ENTRY_NOTES.map((note) => (
              <p
                key={note}
                className="flex items-start gap-2 text-[16px] leading-relaxed text-foreground-700"
              >
                <i className="ri-information-line mt-0.5 flex-none text-[17px] text-primary-700" />
                {note}
              </p>
            ))}
          </Reveal>
        </Container>
      </section>

      <section className="border-t border-background-200 bg-background-100 py-16 md:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
            <Reveal>
              <SectionLabel>시작 관련 질문</SectionLabel>
              <h2 className="mt-4 font-heading text-[26px] font-bold leading-[1.26] tracking-tight text-foreground-950 md:text-[32px]">
                시작하기 전에
              </h2>
            </Reveal>
            <Reveal delay={80}>
              <FaqAccordion items={[FAQS[3], FAQS[10], FAQS[4], FAQS[0]]} />
            </Reveal>
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}