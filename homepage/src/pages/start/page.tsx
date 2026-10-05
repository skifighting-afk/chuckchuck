import { Link } from "react-router-dom";
import Container from "@/components/base/Container";
import Reveal from "@/components/base/Reveal";
import SectionLabel from "@/components/base/SectionLabel";
import Seo from "@/components/base/Seo";
import PageHero from "@/components/feature/PageHero";
import { EXTERNAL, ROLE_ENTRIES, ROLE_ENTRY_NOTES } from "@/mocks/site";

const START_FLOW = [
  {
    step: "1",
    title: "화면 먼저 체험",
    body: "로그인 없이 화면을 먼저 눌러 볼 수 있어요. 설치도 카드 등록도 필요하지 않아요.",
    icon: "ri-window-line",
  },
  {
    step: "2",
    title: "사장님은 가게 만들기",
    body: "사장님은 이메일·비밀번호로 가입해 30일 무료 체험으로 가게를 만들어요. 직원 가입 신청 관리에서 매장별 조건을 설정해요.",
    icon: "ri-store-3-line",
  },
  {
    step: "3",
    title: "직원 직접 신청·사장님 수락",
    body: "직원은 이메일로 계정을 만들고 가게 코드를 넣어 합류를 신청해요. 사장님이 신청 정보와 계약을 검토해 수락하면 연결되고, 매장 QR을 출근·퇴근 때 스캔해요.",
    icon: "ri-user-follow-line",
  },
];

export default function Start() {
  return (
    <>
      <Seo
        title="시작하기 | 척척사장 사장님·직원 시작"
        description="사장님과 직원이 각자 맞는 경로로 시작해요. 사장님은 이메일로 가입해 가게를 만들고, 직원은 이메일 가입 후 가게 코드를 넣어 합류를 신청한 뒤 사장님이 수락해 연결돼요. 무료 화면 체험은 로그인 없이 열려요."
        path="/start"
        keywords="척척사장 시작하기, 사장님 회원가입, 사장님 로그인, 직원 가입·가게 합류, 직원 로그인"
      />
      <PageHero
        label="시작하기"
        title="사장님과 직원, 각자 맞는 길로 시작해요"
        lead="사장님은 이메일로 가입해 가게를 만들고, 직원은 이메일로 가입해 합류를 신청해요. 각자 맞는 로그인 화면으로 들어가고, 무료 화면 체험은 로그인 없이 열려요."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href={EXTERNAL.demo}
              className="flex min-h-[56px] items-center justify-center whitespace-nowrap rounded-md bg-primary-600 px-7 text-[17px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
            >
              무료로 화면 먼저 체험
            </a>
          </div>
        }
      />

      {/* 역할 선택 — 사장님 / 직원 두 버전 */}
      <section className="bg-background-100 py-16 md:py-24">
        <Container>
          <Reveal className="max-w-2xl">
            <SectionLabel>역할 선택</SectionLabel>
            <h2 className="mt-4 font-heading text-[28px] font-bold leading-[1.24] tracking-tight text-foreground-950 md:text-[38px]">
              사장님이신가요, 직원이신가요?
            </h2>
            <p className="mt-4 text-[18px] leading-relaxed text-foreground-700">
              역할에 맞는 카드에서 바로 시작하세요. 로그인은 각 역할에 맞는 화면으로 열려요.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {ROLE_ENTRIES.map((entry, index) => (
              <Reveal
                key={entry.id}
                delay={index * 60}
                className="flex flex-col rounded-lg border border-background-200 bg-background-50 p-6 md:p-8"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-background-100 text-primary-700">
                    <i className={`${entry.icon} text-[24px]`} />
                  </span>
                  <span
                    className={`rounded-full px-3.5 py-1.5 text-[14px] font-semibold ${
                      entry.id === "employee"
                        ? "bg-accent-100 text-accent-900"
                        : "bg-primary-100 text-primary-900"
                    }`}
                  >
                    {entry.role}
                  </span>
                </div>

                <h3 className="mt-5 font-heading text-[24px] font-bold tracking-tight text-foreground-950">
                  {entry.title}
                </h3>
                <p className="mt-3 text-[16px] leading-relaxed text-foreground-700">{entry.body}</p>

                <ul className="mt-5 flex flex-wrap gap-2">
                  {entry.steps.map((step, stepIndex) => (
                    <li
                      key={step}
                      className="flex items-center gap-1.5 rounded-full bg-background-100 px-3.5 py-1.5 text-[14px] text-foreground-800"
                    >
                      <span className="font-heading font-bold text-primary-700">
                        {stepIndex + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex flex-col gap-3 pt-6">
                  {entry.actions.map((action) => (
                    <div key={action.label}>
                      <a
                        href={action.href}
                        target="_top"
                        rel="noopener noreferrer"
                        className={
                          action.primary
                            ? "flex min-h-[56px] items-center justify-center whitespace-nowrap rounded-md bg-primary-600 px-6 text-[17px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
                            : "flex min-h-[56px] items-center justify-center whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-6 text-[17px] font-medium text-foreground-900 transition-colors hover:border-foreground-300"
                        }
                      >
                        {action.label}
                      </a>
                      <p className="mt-1.5 text-center text-[14px] text-foreground-600">
                        {action.note}
                      </p>
                    </div>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>

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

      <section className="bg-background-50 py-16 md:py-24">
        <Container>
          <Reveal className="max-w-2xl">
            <SectionLabel>이렇게 시작해요</SectionLabel>
            <h2 className="mt-4 font-heading text-[28px] font-bold leading-[1.24] tracking-tight text-foreground-950 md:text-[38px]">
              세 단계면 준비 끝
            </h2>
            <p className="mt-4 text-[18px] leading-relaxed text-foreground-700">
              화면으로 먼저 확인한 뒤, 사장님은 이메일로 가입해 가게를 만들고 직원을 연결해요.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {START_FLOW.map((item, index) => (
              <Reveal
                key={item.step}
                delay={index * 60}
                className="rounded-lg border border-background-200 bg-background-50 p-6 md:p-7"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-primary-600 font-heading text-[20px] font-bold text-background-50">
                    {item.step}
                  </span>
                  <i className={`${item.icon} text-[26px] text-primary-700`} />
                </div>
                <h3 className="mt-5 font-heading text-[21px] font-bold text-foreground-950">
                  {item.title}
                </h3>
                <p className="mt-2.5 text-[16px] leading-relaxed text-foreground-700">{item.body}</p>
              </Reveal>
            ))}
          </div>

          <Reveal delay={180} className="mt-8">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-[16px] font-semibold text-primary-700 transition-colors hover:text-primary-800"
            >
              요금 자세히 보기
              <i className="ri-arrow-right-line text-[18px]" />
            </Link>
          </Reveal>
        </Container>
      </section>
    </>
  );
}