import Container from "@/components/base/Container";
import Reveal from "@/components/base/Reveal";
import SectionLabel from "@/components/base/SectionLabel";
import Seo from "@/components/base/Seo";
import PageHero from "@/components/feature/PageHero";
import FinalCta from "@/pages/home/components/FinalCta";
import { SECURITY_PRINCIPLES } from "@/mocks/site";

const PERMISSION_ROWS = [
  { area: "근무표", owner: "관리·확정", manager: "작성·조정", staff: "확인" },
  { area: "출퇴근·휴게 기록", owner: "확인", manager: "확인", staff: "기록" },
  { area: "출퇴근 정정 요청", owner: "승인", manager: "검토", staff: "요청" },
  { area: "급여 확정·해제", owner: "실행", manager: "—", staff: "명세서 확인" },
  { area: "근로조건 문서", owner: "관리", manager: "—", staff: "확인" },
];

const NOT_CLAIMED = [
  "미확인 ISO 등 보안 인증",
  "암호화 수준 보증",
  "24시간 대응 SLA 보장",
  "백업 보증",
];

export default function Security() {
  return (
    <>
      <Seo
        title="데이터·권한 안내 | 척척사장 접근 관리"
        description="척척사장의 데이터 접근 원칙을 안내합니다. 역할 기반 서버 권한 확인, 개인별 필요한 정보만 제공, 변경 이력 기록을 원칙으로 합니다. 확인되지 않은 인증이나 보증은 주장하지 않습니다."
        path="/security"
        keywords="척척사장 데이터 권한, 역할 기반 접근, 출퇴근 데이터 관리, 매장 정보 보호"
      />
      <PageHero
        label="데이터·권한 안내"
        title="누가 무엇을 볼 수 있는지 분명하게"
        lead="척척사장은 역할에 따라 볼 수 있는 정보를 구분하고, 중요한 변경은 기록으로 남깁니다. 확인되지 않은 보증은 안내하지 않습니다."
      />

      <section className="bg-background-50 py-16 md:py-24">
        <Container>
          <Reveal className="max-w-2xl">
            <SectionLabel>접근 원칙</SectionLabel>
            <h2 className="mt-4 font-heading text-[28px] font-bold leading-[1.25] tracking-tight text-foreground-950 md:text-[36px]">
              세 가지 원칙으로 데이터를 다룹니다
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {SECURITY_PRINCIPLES.map((item, index) => (
              <Reveal
                key={item.title}
                delay={index * 70}
                className="rounded-lg border border-background-200 bg-background-50 p-6"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary-50 text-primary-700">
                  <i className={`${item.icon} text-[22px]`} />
                </span>
                <h3 className="mt-4 font-heading text-[18px] font-bold text-foreground-950">
                  {item.title}
                </h3>
                <p className="mt-2.5 text-[16px] leading-relaxed text-foreground-600">{item.body}</p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-background-200 bg-background-100 py-16 md:py-24">
        <Container>
          <Reveal className="max-w-2xl">
            <SectionLabel>역할별 접근 범위</SectionLabel>
            <h2 className="mt-4 font-heading text-[26px] font-bold leading-[1.26] tracking-tight text-foreground-950 md:text-[34px]">
              역할에 따라 다르게 열립니다
            </h2>
          </Reveal>

          <Reveal className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse overflow-hidden rounded-lg border border-background-200 bg-background-50 text-left">
              <thead>
                <tr className="bg-background-100">
                  <th className="border-b border-background-200 px-5 py-4 font-label text-[15px] font-semibold text-foreground-700">
                    항목
                  </th>
                  <th className="border-b border-background-200 px-5 py-4 font-label text-[15px] font-semibold text-foreground-700">
                    사장님
                  </th>
                  <th className="border-b border-background-200 px-5 py-4 font-label text-[15px] font-semibold text-foreground-700">
                    매니저
                  </th>
                  <th className="border-b border-background-200 px-5 py-4 font-label text-[15px] font-semibold text-foreground-700">
                    직원
                  </th>
                </tr>
              </thead>
              <tbody>
                {PERMISSION_ROWS.map((row) => (
                  <tr key={row.area}>
                    <td className="border-b border-background-200 px-5 py-4 text-[16px] font-medium text-foreground-900">
                      {row.area}
                    </td>
                    <td className="border-b border-background-200 px-5 py-4 text-[16px] text-foreground-700">
                      {row.owner}
                    </td>
                    <td className="border-b border-background-200 px-5 py-4 text-[16px] text-foreground-700">
                      {row.manager}
                    </td>
                    <td className="border-b border-background-200 px-5 py-4 text-[16px] text-foreground-700">
                      {row.staff}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
          <p className="mt-4 text-[16px] leading-relaxed text-foreground-500">
            실제 접근 범위는 서버에서 권한을 확인해 결정되며, 위 표는 역할별 기본 범위를 설명한
            것입니다.
          </p>
        </Container>
      </section>

      <section className="border-t border-background-200 bg-background-50 py-16 md:py-20">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
            <Reveal>
              <SectionLabel>안내 원칙</SectionLabel>
              <h2 className="mt-4 font-heading text-[24px] font-bold leading-[1.28] tracking-tight text-foreground-950 md:text-[30px]">
                확인되지 않은 것은 주장하지 않습니다
              </h2>
              <p className="mt-4 text-[17px] leading-relaxed text-foreground-600">
                아래 항목은 현재 확인되거나 인증된 바가 없어 안내하지 않습니다. 확인 가능한 시점에
                사실에 근거해 안내합니다.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <ul className="overflow-hidden rounded-lg border border-background-200 bg-background-50">
                {NOT_CLAIMED.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 border-b border-background-200 px-5 py-4 text-[16px] text-foreground-600 last:border-b-0"
                  >
                    <i className="ri-close-line text-[16px] text-foreground-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}