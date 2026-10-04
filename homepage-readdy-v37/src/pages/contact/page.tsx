import { Link } from "react-router-dom";
import Container from "@/components/base/Container";
import Reveal from "@/components/base/Reveal";
import SectionLabel from "@/components/base/SectionLabel";
import Seo from "@/components/base/Seo";
import TrialNote from "@/components/base/TrialNote";
import PageHero from "@/components/feature/PageHero";
import { CONTACT_FLOW, EXTERNAL } from "@/mocks/site";

export default function Contact() {
  return (
    <>
      <Seo
        title="도입 준비 안내 | 척척사장봇 사전 체험"
        description="척척사장봇 도입 준비 안내입니다. 별도의 문의 폼 대신 화면 먼저 보는 사전 체험으로 시작해요. 사장님은 초대 없이 가게를 만들고, 직원은 직접 가입해 합류를 신청하고 사장님이 수락해 연결해요."
        path="/contact"
        keywords="척척사장봇 도입 안내, 사전 체험 안내, 매장 관리 시작"
      />
      <PageHero
        label="도입 준비 안내"
        title="문의 폼 대신, 준비된 체험으로"
        lead="지금은 별도의 문의 폼을 운영하지 않아요. 대신 화면 먼저 보는 사전 체험으로 척척사장봇을 먼저 경험해 보세요. 사장님은 초대 없이 시작할 수 있어요."
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
          <Reveal className="max-w-2xl">
            <SectionLabel>사전 체험 흐름</SectionLabel>
            <h2 className="mt-4 font-heading text-[28px] font-bold leading-[1.24] tracking-tight text-foreground-950 md:text-[36px]">
              이렇게 시작하시면 돼요
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {CONTACT_FLOW.map((item, index) => (
              <Reveal
                key={item.step}
                delay={index * 70}
                className="rounded-lg border border-background-200 bg-background-50 p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-primary-600 font-heading text-[20px] font-bold text-background-50">
                    {item.step}
                  </span>
                  <i className={`${item.icon} text-[26px] text-primary-700`} />
                </div>
                <h3 className="mt-5 font-heading text-[20px] font-bold text-foreground-950">
                  {item.title}
                </h3>
                <p className="mt-2.5 text-[16px] leading-relaxed text-foreground-700">{item.body}</p>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-10">
            <div className="flex flex-col gap-5 rounded-lg border border-primary-200 bg-primary-50 p-6 md:flex-row md:items-center md:justify-between md:p-7">
              <div>
                <p className="font-heading text-[20px] font-bold text-primary-950">
                  지금 무료로 시작해 보세요
                </p>
                <p className="mt-2 max-w-lg text-[16px] leading-relaxed text-primary-900">
                  사장님은 초대 없이 가게를 만들고, 직원은 직접 가입해 합류를 신청하고 사장님이 수락하면 연결돼요. 기본 기능은 바로 확인할 수 있어요.
                </p>
                <TrialNote className="mt-4" />
              </div>
              <a
                href={EXTERNAL.demo}
                className="flex min-h-[56px] flex-none items-center justify-center whitespace-nowrap rounded-md bg-primary-600 px-7 text-[17px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
              >
                무료로 시작하기
              </a>
            </div>
          </Reveal>
        </Container>
      </section>

      <section className="border-t border-background-200 bg-background-100 py-16 md:py-20">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
            <Reveal>
              <SectionLabel>추후 도입 문의</SectionLabel>
              <h2 className="mt-4 font-heading text-[26px] font-bold leading-[1.26] tracking-tight text-foreground-950 md:text-[32px]">
                문의 창구는 준비 중이에요
              </h2>
            </Reveal>
            <Reveal delay={80}>
              <div className="rounded-lg border border-background-200 bg-background-50 p-6">
                <p className="text-[17px] leading-relaxed text-foreground-700">
                  척척사장봇은 지금 정식 판매 전 준비 단계라서 별도의 도입 문의 폼을 운영하지 않아요.
                  확인되지 않은 문의 창구를 안내하거나, 보내지 않은 문의를 보낸 것처럼 처리하지 않아요.
                </p>
                <p className="mt-4 text-[17px] leading-relaxed text-foreground-700">
                  문의 창구가 정해지면 이 페이지에서 사실대로 안내할게요. 그 전까지는 위의 사전 체험
                  흐름을 이용해 주세요.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/guide"
                    className="inline-flex min-h-[52px] items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-5 text-[16px] font-medium text-foreground-900 transition-colors hover:border-foreground-300"
                  >
                    시작 안내 보기
                    <i className="ri-arrow-right-line text-[18px]" />
                  </Link>
                  <Link
                    to="/security"
                    className="inline-flex min-h-[52px] items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-5 text-[16px] font-medium text-foreground-900 transition-colors hover:border-foreground-300"
                  >
                    데이터·권한 안내
                    <i className="ri-arrow-right-line text-[18px]" />
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>
    </>
  );
}