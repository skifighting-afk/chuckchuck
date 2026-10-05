import { Link } from "react-router-dom";
import Container from "@/components/base/Container";
import Logo from "@/components/base/Logo";
import MotionToggle from "@/components/feature/MotionToggle";
import TextSizeToggle from "@/components/feature/TextSizeToggle";
import { EXTERNAL, FOOTER_GROUPS, PRICING_DISCLAIMER, TRIAL_NOTE } from "@/mocks/site";

export default function SiteFooter() {
  return (
    <footer className="bg-primary-950 text-background-100">
      <Container>
        <div className="grid gap-10 py-14 md:grid-cols-12 md:py-16">
          <div className="md:col-span-5">
            <Logo tone="dark" />
            <p className="mt-5 max-w-sm text-[16px] leading-relaxed text-background-200">
              사장님 옆의 든든한 매장 비서, 척척사장. 근무표부터 출퇴근, 급여 마감까지 바쁜
              사장님의 할 일을 한곳에 모아요.
            </p>
            <p className="mt-5 max-w-sm text-[16px] leading-relaxed text-background-200">
              {TRIAL_NOTE}
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 md:col-span-4">
            {FOOTER_GROUPS.map((group) => (
              <div key={group.title}>
                <h4 className="text-[15px] font-semibold text-accent-300">{group.title}</h4>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.to}>
                      {link.external ? (
                        <a
                          href={link.to}
                          className="text-[16px] text-background-100 transition-colors hover:text-background-50"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          to={link.to}
                          className="text-[16px] text-background-100 transition-colors hover:text-background-50"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="md:col-span-3">
            <h4 className="text-[15px] font-semibold text-accent-300">앱 바로가기</h4>
            <ul className="mt-4 space-y-3">
              <li>
                <a
                  href={EXTERNAL.demo}
                  className="text-[16px] text-background-100 transition-colors hover:text-background-50"
                >
                  무료로 시작하기
                </a>
              </li>
              <li>
                <a
                  href={EXTERNAL.appStart}
                  className="text-[16px] text-background-100 transition-colors hover:text-background-50"
                >
                  내 가게 열기
                </a>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-[16px] text-background-100 transition-colors hover:text-background-50"
                >
                  도입 준비 안내
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-background-50/10 py-6">
          <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-background-200 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl">{PRICING_DISCLAIMER}</p>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <TextSizeToggle />
                <MotionToggle />
              </div>
              <p className="whitespace-nowrap">© 2026 척척사장</p>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}