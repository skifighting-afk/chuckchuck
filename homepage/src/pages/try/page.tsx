import { Link, useSearchParams } from "react-router-dom";
import Container from "@/components/base/Container";
import { EXTERNAL } from "@/mocks/site";
import Reveal from "@/components/base/Reveal";
import Seo from "@/components/base/Seo";
import BrandExperience from "@/pages/home/components/BrandExperience";
import QRStaffDemo from "@/components/feature/QRStaffDemo";

export default function Try() {
  const [searchParams] = useSearchParams();
  const isEmployeeDemo = searchParams.get("employeeDemo") === "1";

  if (isEmployeeDemo) {
    return (
      <>
        <Seo
          title="내 출근 기록 | 척척사장 직원 체험"
          description="QR로 열린 직원 화면이에요. 실제 개인정보 입력 없이 출근·휴게·퇴근 버튼만 눌러 보는 가상 직원 체험이에요. 모든 기록은 화면에서만 동작하는 예시예요."
          path="/try"
          keywords="직원 출근 체험, QR 출근, 매장 근태 체험"
        />
        <section className="bg-background-50">
          <Container>
            <div className="mx-auto max-w-[720px] pb-14 pt-10 md:pb-20 md:pt-14">
              <Reveal>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-100 px-3 py-1 text-[13px] font-semibold text-secondary-900">
                  <i className="ri-user-smile-line text-[14px]" />
                  가상 직원 체험
                </span>
              </Reveal>
              <Reveal delay={60}>
                <h1 className="mt-4 font-heading text-[28px] font-bold leading-[1.2] tracking-tight text-foreground-950 md:text-[36px]">
                  내 출근 기록
                </h1>
              </Reveal>
              <Reveal delay={100}>
                <p className="mt-3 text-[16px] leading-relaxed text-foreground-700">
                  QR로 열린 화면이에요. 실제 개인정보 입력 없이 출근·휴게·퇴근 버튼만 눌러 보는 가상
                  체험이에요.
                </p>
              </Reveal>

              <Reveal delay={140} className="mt-6">
                <QRStaffDemo />
              </Reveal>

              <Reveal delay={180} className="mt-6">
                <Link
                  to="/try"
                  className="inline-flex items-center gap-1.5 whitespace-nowrap text-[16px] font-semibold text-primary-700 transition-colors hover:text-primary-800"
                >
                  사장님 화면 체험으로 돌아가기
                  <i className="ri-arrow-right-line text-[18px]" />
                </Link>
              </Reveal>
            </div>
          </Container>
        </section>
      </>
    );
  }

  return (
    <>
      <Seo
        title="화면 먼저 보기 | 척척사장 사전 체험"
        description="회원가입 없이 척척사장 화면을 먼저 눌러 보세요. 이번 달 예상 급여와 오늘 출근 상태를 요약으로 보고, 급여·출퇴근·근무표 상세를 한 동작으로 열어볼 수 있어요. 모든 화면은 가상 예시예요."
        path="/try"
        keywords="척척사장 사전 체험, 매장 관리 화면, 출퇴근 데모, 급여 데모, 근무표 데모"
      />
      <section className="border-b border-background-200 bg-background-50">
        <Container>
          <div className="pb-8 pt-12 md:pb-10 md:pt-16">
            <Reveal>
              <h1 className="font-heading text-[30px] font-bold leading-[1.2] tracking-tight text-foreground-950 md:text-[40px]">
                먼저 눌러보세요
              </h1>
            </Reveal>
            <Reveal delay={60}>
              <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-foreground-700">
                가입 없이 매장 화면을 그대로 눌러볼 수 있어요. 모든 숫자는 가상 예시예요.
              </p>
            </Reveal>
            <Reveal delay={100} className="mt-4">
              <a
                href={EXTERNAL.appStart}
                className="inline-flex items-center gap-1.5 whitespace-nowrap text-[16px] font-semibold text-primary-700 transition-colors hover:text-primary-800"
              >
                내 가게 만들기
                <i className="ri-arrow-right-line text-[18px]" />
              </a>
            </Reveal>
          </div>
        </Container>
      </section>
      <BrandExperience />
    </>
  );
}