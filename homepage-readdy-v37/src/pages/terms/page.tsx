import { Link } from "react-router-dom";
import Container from "@/components/base/Container";
import Reveal from "@/components/base/Reveal";
import Seo from "@/components/base/Seo";
import PageHero from "@/components/feature/PageHero";

const SECTIONS = [
  {
    no: "01",
    title: "서비스 소개",
    body: "척척사장봇은 식당·카페·소매점 등 매장의 직원·출퇴근·스케줄·급여·근로조건 문서 정리를 돕는 서비스예요.",
  },
  {
    no: "02",
    title: "현재 준비 상태",
    body: "척척사장봇은 정식 판매 전 준비 단계입니다. 서비스 이용약관은 현재 확정 전이며, 확정되는 시점에 이 페이지에서 안내합니다.",
  },
  {
    no: "03",
    title: "요금과 결제",
    body: "안내된 요금은 정식 판매 전 준비 단계의 제안이며 변경될 수 있습니다. 현재는 결제 기능을 제공하지 않아 어떤 금액도 청구되지 않습니다.",
  },
  {
    no: "04",
    title: "운영자 정보",
    body: "사업자 정보 등 운영자 관련 정보는 정식 판매 전에 확정해 안내할 예정입니다. 확정 전에는 임의의 정보를 표시하지 않습니다.",
  },
  {
    no: "05",
    title: "문의 안내",
    body: "도입과 관련한 안내는 도입 준비 안내 페이지에서 확인하실 수 있습니다.",
  },
];

export default function Terms() {
  return (
    <>
      <Seo
        title="서비스 준비 안내 | 척척사장봇"
        description="척척사장봇은 정식 판매 전 준비 단계입니다. 서비스 이용약관과 운영자 정보는 확정 전이며, 확정 시점에 안내할 예정입니다. 현재는 결제 기능을 제공하지 않습니다."
        path="/terms"
        keywords="척척사장봇 서비스 준비, 이용약관 준비, 판매 준비 안내"
      />
      <PageHero
        label="서비스 준비 안내"
        title="약관과 운영자 정보는 준비 중입니다"
        lead="척척사장봇은 정식 판매 전 준비 단계입니다. 확정되지 않은 내용을 사실인 것처럼 안내하지 않기 위해, 현재 상태를 있는 그대로 알려드립니다."
      />

      <section className="bg-background-50 py-16 md:py-20">
        <Container>
          <Reveal>
            <div className="flex flex-col gap-3 rounded-lg border border-secondary-200 bg-secondary-50 p-5 sm:flex-row sm:items-center">
              <i className="ri-time-line text-[20px] text-secondary-900" />
              <p className="text-[16px] leading-relaxed text-secondary-900">
                정식 판매 전 운영자 정보 및 정책을 확정해 안내할 예정입니다.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 space-y-8">
            {SECTIONS.map((section) => (
              <Reveal
                key={section.no}
                className="border-t border-background-200 pt-6"
              >
                <div className="grid gap-3 md:grid-cols-[80px_1fr] md:gap-8">
                  <span className="font-label text-[15px] font-semibold text-primary-600">
                    {section.no}
                  </span>
                  <div>
                    <h2 className="font-heading text-[18px] font-bold tracking-tight text-foreground-950 md:text-[20px]">
                      {section.title}
                    </h2>
                    <p className="mt-2.5 max-w-2xl text-[17px] leading-relaxed text-foreground-600">
                      {section.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-12">
            <div className="flex flex-col gap-4 rounded-lg border border-background-200 bg-background-100 p-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[16px] leading-relaxed text-foreground-700">
                개인정보 관련 안내는 개인정보 안내 준비 페이지에서 확인하실 수 있습니다.
              </p>
              <Link
                to="/privacy"
                className="inline-flex min-h-[44px] flex-none items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-5 text-[16px] font-medium text-foreground-900 transition-colors hover:border-foreground-300"
              >
                개인정보 안내 보기
                <i className="ri-arrow-right-line text-[16px]" />
              </Link>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}