import Seo from "@/components/base/Seo";
import Hero from "@/pages/home/components/Hero";
import BrandExperience from "@/pages/home/components/BrandExperience";
import BrandFilm from "@/components/feature/BrandFilm";
import StartSteps from "@/pages/home/components/StartSteps";
import PricingPreview from "@/pages/home/components/PricingPreview";
import FaqSection from "@/pages/home/components/FaqSection";
import FinalCta from "@/pages/home/components/FinalCta";

export default function Home() {
  return (
    <>
      <Seo
        title="척척사장 | 직원 출근부터 월급 정리까지"
        description="앱 설치 없이 휴대폰으로 여는 매장 관리 비서, 척척사장. 직원 출근, 근무표, 급여 정리를 한곳에서 확인하세요. 무료로 시작하고 카드 등록 없이 사용할 수 있어요."
        path="/"
        keywords="척척사장, 척척이, 매장 직원관리, 출퇴근 관리, 근무표, 급여 정리, 소상공인"
      />
      <Hero />
      <BrandExperience />
      <BrandFilm />
      <StartSteps />
      <PricingPreview />
      <FaqSection />
      <FinalCta />
    </>
  );
}