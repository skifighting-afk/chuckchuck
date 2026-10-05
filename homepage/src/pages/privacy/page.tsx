import { Link } from "react-router-dom";
import Container from "@/components/base/Container";
import Reveal from "@/components/base/Reveal";
import Seo from "@/components/base/Seo";
import PageHero from "@/components/feature/PageHero";

const SECTIONS = [
  {
    no: "01",
    title: "안내 상태",
    body: "척척사장의 개인정보 처리방침은 정식 판매 전 확정 예정입니다. 확정되는 시점에 이 페이지에서 자세히 안내합니다.",
  },
  {
    no: "02",
    title: "정보 수집",
    body: "현재 척척사장 웹사이트는 별도의 개인정보 입력 폼을 운영하지 않습니다. 이름, 연락처, 이메일 등을 사이트에서 수집하지 않습니다.",
  },
  {
    no: "03",
    title: "사전 체험",
    body: "사전 체험은 로그인을 통해 외부 앱에서 진행되며, 해당 앱의 개인정보 안내를 따릅니다.",
  },
  {
    no: "04",
    title: "변경 안내",
    body: "정책이 확정되거나 변경되면 이 페이지에서 안내합니다. 확정 전까지는 확인되지 않은 내용을 안내하지 않습니다.",
  },
];

export default function Privacy() {
  return (
    <>
      <Seo
        title="개인정보 안내 준비 | 척척사장"
        description="척척사장의 개인정보 처리방침은 정식 판매 전 확정 예정입니다. 현재 척척사장 웹사이트는 별도의 개인정보 입력 폼을 운영하지 않으며, 입력 정보를 수집하지 않습니다."
        path="/privacy"
        keywords="척척사장 개인정보 안내, 개인정보 처리방침 준비, 정보 수집"
      />
      <PageHero
        label="개인정보 안내 준비"
        title="개인정보 안내도 준비 중입니다"
        lead="아직 확정되지 않은 개인정보 안내 문구를 사실인 것처럼 제공하지 않습니다. 현재 상태를 정확하게 알려드립니다."
      />

      <section className="bg-background-50 py-16 md:py-20">
        <Container>
          <Reveal>
            <div className="flex flex-col gap-3 rounded-lg border border-secondary-200 bg-secondary-50 p-5 sm:flex-row sm:items-center">
              <i className="ri-file-shield-2-line text-[20px] text-secondary-900" />
              <p className="text-[16px] leading-relaxed text-secondary-900">
                정식 판매 전 개인정보 처리방침을 확정해 안내할 예정입니다.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 space-y-8">
            {SECTIONS.map((section) => (
              <Reveal key={section.no} className="border-t border-background-200 pt-6">
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
                서비스 준비 상태는 서비스 준비 안내 페이지에서 확인하실 수 있습니다.
              </p>
              <Link
                to="/terms"
                className="inline-flex min-h-[44px] flex-none items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-5 text-[16px] font-medium text-foreground-900 transition-colors hover:border-foreground-300"
              >
                서비스 준비 안내 보기
                <i className="ri-arrow-right-line text-[16px]" />
              </Link>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}