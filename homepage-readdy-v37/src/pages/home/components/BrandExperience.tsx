import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Container from "@/components/base/Container";
import SectionLabel from "@/components/base/SectionLabel";
import BrandMotion from "@/components/feature/BrandMotion";
import CheckMark from "@/components/feature/CheckMark";
import MascotGuide from "@/components/feature/MascotGuide";
import { DEMO_STEPS, EXTERNAL } from "@/mocks/site";
import AppShell from "./demo/AppShell";
import HomeSummaryScreen from "./demo/HomeSummaryScreen";
import type { SummaryTarget } from "./demo/HomeSummaryScreen";
import ClockInScreen from "./demo/ClockInScreen";
import ScheduleScreen from "./demo/ScheduleScreen";
import PayrollScreen from "./demo/PayrollScreen";
import EmployeeScreen from "./demo/EmployeeScreen";
import MultiStoreScreen from "./demo/MultiStoreScreen";
import ContractScreen from "./demo/ContractScreen";

export type DemoMenu =
  | "홈"
  | "직원 관리"
  | "근로계약서"
  | "출퇴근 기록"
  | "근무 스케줄"
  | "급여·명세서"
  | "매장 관리·비교";

// 안내 말풍선(척척이)을 붙이는 화면만 단계 id를 가진다.
const STEP_BY_MENU: Record<DemoMenu, string> = {
  홈: "",
  "직원 관리": "",
  "근로계약서": "",
  "출퇴근 기록": "clock",
  "근무 스케줄": "schedule",
  "급여·명세서": "payroll",
  "매장 관리·비교": "",
};

const MENU_BY_SUMMARY: Record<SummaryTarget, DemoMenu> = {
  clock: "출퇴근 기록",
  schedule: "근무 스케줄",
  payroll: "급여·명세서",
};

interface DemoStageProps {
  initialMenu?: DemoMenu;
  className?: string;
}

/**
 * 여섯 화면(홈·직원·출퇴근·근무표·급여·비교)을 공통 AppShell로 전환하는 재사용 스테이지.
 * 홈 페이지와 제품 페이지가 같은 컴포넌트를 쓰고, 화면별 기존 demo 파일을 그대로 재사용한다.
 * 자동 전환은 없고 메뉴 버튼을 눌렀을 때만 바뀐다. 바깥 테두리 장식만 정적이며 움직임은 두지 않는다.
 */
export function DemoStage({ initialMenu = "홈", className = "" }: DemoStageProps) {
  const [menu, setMenu] = useState<DemoMenu>(initialMenu);
  const stepId = STEP_BY_MENU[menu];
  const step = stepId ? DEMO_STEPS.find((item) => item.id === stepId) : undefined;

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-lg border border-background-200 bg-background-100 ring-1 ring-primary-200/60">
        {step ? (
          <MascotGuide
            stepId={step.id}
            headline={step.headline}
            onBack={() => setMenu("홈")}
          />
        ) : null}
        <AppShell activeMenu={menu} onNavigate={(label) => setMenu(label as DemoMenu)}>
          {menu === "홈" ? (
            <HomeSummaryScreen onOpen={(target) => setMenu(MENU_BY_SUMMARY[target])} />
          ) : (
            <div key={menu} className="bm-step">
              {menu === "직원 관리" ? <EmployeeScreen /> : null}
              {menu === "근로계약서" ? <ContractScreen /> : null}
              {menu === "출퇴근 기록" ? <ClockInScreen /> : null}
              {menu === "근무 스케줄" ? <ScheduleScreen /> : null}
              {menu === "급여·명세서" ? <PayrollScreen /> : null}
              {menu === "매장 관리·비교" ? <MultiStoreScreen /> : null}
            </div>
          )}
        </AppShell>
      </div>

      {step ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {step.captions.map((caption) => (
            <p key={caption} className="text-[17px] leading-relaxed text-foreground-700">
              {caption}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 브랜드 제품체험 섹션 (홈·제품 페이지 공통).
 * 기본 화면은 "우리 가게" 홈 요약이고, 왼쪽 메뉴(모바일은 상단 버튼)로 여섯 화면을 오간다.
 * 스테이지 아래 안내 문구는 가상 예시 데이터임을 알린다.
 */
export default function BrandExperience() {
  const [searchParams] = useSearchParams();
  // QR로 들어온 직원 모드(/try?employeeDemo=1&branch=...)면 곧바로 출퇴근 화면을 먼저 연다.
  const isEmployeeDemo = searchParams.get("employeeDemo") === "1";

  return (
    <section
      id="product-demo"
      className="scroll-mt-28 border-t border-background-200 bg-background-50 py-16 md:py-24"
    >
      <Container>
        <div className="max-w-3xl">
          <SectionLabel>직접 눌러 보세요</SectionLabel>
          <h2 className="mt-4 font-heading text-[30px] font-bold leading-[1.22] tracking-tight text-foreground-950 md:text-[42px]">
            오늘 가게, 한 화면에서 척척
          </h2>
          <p className="mt-4 text-[18px] leading-relaxed text-foreground-700">
            이번 달 예상 급여와 오늘 상태를 먼저 보고, 보고 싶은 것만 눌러요. 왼쪽(모바일은 위) 메뉴로
            다른 화면도 바로 볼 수 있어요. 자동으로 넘어가지 않아요.
          </p>
        </div>

        <DemoStage className="mt-8" initialMenu={isEmployeeDemo ? "출퇴근 기록" : "홈"} />

        <p className="mt-5 text-[15px] leading-relaxed text-foreground-600">
          화면 속 직원 이름(김예시·박샘플·이체험·임예제)과 숫자는 모두 가상으로 만든 예시예요. 실제
          서버에 저장되지 않아요.
        </p>

        <div className="mt-8 flex flex-col gap-4 rounded-lg border border-primary-300 bg-primary-50/60 p-6 md:flex-row md:items-center md:justify-between md:p-7">
          <div className="flex items-start gap-4">
            <BrandMotion className="hidden h-11 w-11 flex-none items-center justify-center rounded-full bg-background-50 sm:flex">
              <CheckMark size={26} />
            </BrandMotion>
            <div className="max-w-xl">
              <p className="font-heading text-[19px] font-semibold text-foreground-950">
                실제 프로그램 화면도 열어볼 수 있어요
              </p>
              <p className="mt-2 text-[16px] leading-relaxed text-foreground-700">
                사장님은 초대 없이 가입해 바로 시작할 수 있어요. 여기 예시 화면은 가상 데이터라 저장되지
                않아요.
              </p>
            </div>
          </div>
          <a
            href={EXTERNAL.demo}
            target="_top"
            className="flex min-h-[56px] items-center justify-center whitespace-nowrap rounded-md bg-primary-600 px-7 text-[17px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
          >
            실제 프로그램 화면 열기
          </a>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <a
            href={EXTERNAL.demo}
            target="_top"
            className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap text-[16px] font-semibold text-primary-700 transition-colors hover:text-primary-800"
          >
            <i className="ri-window-line text-[18px]" />
            전체 화면으로 체험하기
          </a>
          <a
            href={EXTERNAL.appStart}
            target="_top"
            className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap text-[16px] font-semibold text-primary-700 transition-colors hover:text-primary-800"
          >
            <i className="ri-rocket-2-line text-[18px]" />
            무료로 시작 안내 보기
          </a>
        </div>
      </Container>
    </section>
  );
}