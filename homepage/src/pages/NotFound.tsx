import { Link } from "react-router-dom";
import Container from "@/components/base/Container";
import Seo from "@/components/base/Seo";

export default function NotFound() {
  return (
    <>
      <Seo
        title="페이지를 찾을 수 없습니다 | 척척사장봇"
        description="요청하신 페이지를 찾을 수 없습니다. 척척사장봇 홈페이지에서 제품소개, 요금제, 시작가이드를 확인하세요."
        path="/"
      />
      <section className="flex min-h-[60vh] items-center bg-background-50">
        <Container>
          <div className="mx-auto max-w-xl py-20 text-center">
            <span className="font-label text-[12px] font-semibold uppercase tracking-[0.2em] text-primary-600">
              404
            </span>
            <h1 className="mt-5 font-heading text-[28px] font-bold leading-[1.25] tracking-tight text-foreground-950 md:text-[38px]">
              페이지를 찾을 수 없습니다
            </h1>
            <p className="mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-foreground-700">
              주소가 변경되었거나 아직 준비되지 않은 페이지일 수 있습니다. 아래에서 필요한 안내를
              확인해 주세요.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/"
                className="flex min-h-[56px] w-full items-center justify-center whitespace-nowrap rounded-md bg-primary-600 px-7 text-[17px] font-semibold text-background-50 transition-colors hover:bg-primary-700 sm:w-auto"
              >
                홈으로 이동
              </Link>
              <Link
                to="/contact"
                className="flex min-h-[56px] w-full items-center justify-center whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-7 text-[17px] font-medium text-foreground-900 transition-colors hover:border-foreground-300 sm:w-auto"
              >
                도입 준비 안내
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}