import Container from "@/components/base/Container";
import { EXTERNAL } from "@/mocks/site";

export default function LaunchBanner() {
  return (
    <div className="relative z-40 w-full bg-primary-800 text-background-50">
      <Container>
        <div className="flex flex-col items-start justify-center gap-1.5 py-2.5 text-[15px] sm:flex-row sm:items-center sm:gap-3 sm:text-center">
          <span className="flex items-center gap-2 font-semibold">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent-400" />
            먼저 경험하는 척척사장
          </span>
          <span aria-hidden="true" className="hidden text-background-300 sm:inline">·</span>
          <span className="text-background-100">가입 없이 화면부터 체험하세요 · 카드 등록 없이</span>
          <a
            href={EXTERNAL.demo}
            className="whitespace-nowrap font-semibold text-accent-300 underline-offset-4 transition-colors hover:text-accent-200 hover:underline"
          >
            무료로 시작하기
          </a>
        </div>
      </Container>
    </div>
  );
}