import { useEffect, useRef, useState } from "react";
import Container from "@/components/base/Container";
import Reveal from "@/components/base/Reveal";
import SectionLabel from "@/components/base/SectionLabel";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { EXTERNAL } from "@/mocks/site";

// 기능 설명을 돕기 위한 가상 예시 영상(720x1280 · 9:16). 실제 저장되는 데이터가 아니다.
// 원본 음악·효과음이 복원된 소리 있는 버전이다.
const FILM_VIDEO =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_3JBiHIWO19NVQIwSnWzVAcACC0c/0071aa64-08d9-4c99-916d-2645a86dc558.mp4";
const FILM_POSTER =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_3JBiHIWO19NVQIwSnWzVAcACC0c/da4053a4-81af-45f1-a578-6efef6a7f71e.png";

const FILM_POINTS = [
  {
    icon: "ri-user-follow-line",
    title: "출근 확인",
    body: "누가 왔는지, 정정이 필요한 기록이 있는지 한 줄로 봐요.",
  },
  {
    icon: "ri-calendar-schedule-line",
    title: "근무표",
    body: "요일마다 누가 언제 일하는지 근무표로 한눈에 확인해요.",
  },
  {
    icon: "ri-wallet-3-line",
    title: "급여 검토",
    body: "근무 기록을 살펴보고 이번 달 급여를 정리해 마감해요.",
  },
];

type SoundPref = "on" | "off" | null;

/**
 * 40초 기능 미리보기(제품 시연 다음, 기능 설명 곁에 붙는 카드형 2열 밴드).
 * - 화면에 보일 때만 src를 붙여 재생하고, 화면을 벗어나면 멈춘다.
 * - 화면 진입 시 소리 있는 재생을 먼저 시도하고, 브라우저가 거절하면 무음 자동재생으로
 *   안전하게 넘어간 뒤 작은 "소리 켜기" 버튼을 보여준다.
 * - 소리 켜기/끄기는 사용자가 직접 누른 선택으로만 바뀌며, 그 선택은 유지된다.
 *   (사용자가 소리를 켠 뒤에는 스크롤로 다시 들어와도 무음으로 되돌리지 않는다.)
 * - 푸터의 "움직임 줄이기"나 기기(prefers-reduced-motion) 설정이 켜지면 자동재생하지 않고
 *   포스터만 보여주며, 소리 버튼도 표시하지 않는다(설명과 상태가 어긋나지 않게).
 * - 로딩 실패 시에도 포스터와 설명이 그대로 남는다. 재생 버튼은 두지 않고 소리 토글만 둔다.
 */
export default function BrandFilm() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const prefRef = useRef<SoundPref>(null);
  const { motionOff } = useMotionPreference();
  const [active, setActive] = useState(false);
  const [failed, setFailed] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  // 화면에 보일 때만 재생 대상으로 삼고, 벗어나거나 움직임을 줄이면 멈춘다.
  useEffect(() => {
    if (motionOff || failed) {
      setActive(false);
      return undefined;
    }
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setActive(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => setActive(entry.isIntersecting));
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [motionOff, failed]);

  // 화면에 보일 때만 src를 붙여 재생한다. 첫 진입은 소리 있는 재생을 시도하고,
  // 거절되면 무음 자동재생으로 넘어간다. 이후에는 사용자가 고른 소리 상태를 따른다.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    if (!active) {
      video.pause();
      return undefined;
    }
    if (!video.getAttribute("src")) {
      video.setAttribute("src", FILM_VIDEO);
      video.load();
    }

    const play = () => {
      const result = video.play();
      if (result && typeof result.catch === "function") {
        result.catch(() => undefined);
      }
    };

    const pref = prefRef.current;
    if (pref === "on") {
      video.muted = false;
      setSoundOn(true);
      play();
    } else if (pref === "off") {
      video.muted = true;
      setSoundOn(false);
      play();
    } else {
      // 첫 자동 시도: 소리를 켠 채로 재생을 시도하고, 거절되면 무음으로 안전하게 넘어간다.
      video.muted = false;
      const result = video.play();
      if (result && typeof result.then === "function") {
        result
          .then(() => setSoundOn(true))
          .catch(() => {
            video.muted = true;
            setSoundOn(false);
            play();
          });
      } else {
        setSoundOn(!video.muted);
      }
    }
    return undefined;
  }, [active]);

  // 버튼 클릭(사용자 제스처)에서만 소리를 켜고/끈다. 이 선택은 유지된다.
  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted) {
      video.muted = false;
      prefRef.current = "on";
      setSoundOn(true);
      const result = video.play();
      if (result && typeof result.catch === "function") {
        result.catch(() => undefined);
      }
    } else {
      video.muted = true;
      prefRef.current = "off";
      setSoundOn(false);
    }
  };

  const showSoundButton = active && !motionOff && !failed;

  return (
    <section className="border-t border-background-200 bg-background-50 py-16 md:py-24">
      <Container>
        <div className="rounded-lg border border-background-200 bg-background-100 p-6 md:p-8 lg:p-10">
          <div className="flex flex-col items-center gap-8 md:flex-row md:items-center md:gap-10 lg:gap-14">
            <Reveal className="flex w-full flex-none justify-center md:w-auto md:justify-start">
              <div className="w-full max-w-[260px] md:w-[280px] md:max-w-none">
                <div
                  ref={wrapperRef}
                  className="relative aspect-[9/16] w-full overflow-hidden rounded-lg border border-background-200 bg-background-50"
                >
                  <img
                    src={FILM_POSTER}
                    alt="출근 확인부터 급여 정리까지의 흐름을 보여주는 가상 예시 영상 포스터"
                    title="척척사장 40초 기능 미리보기"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <video
                    ref={videoRef}
                    muted
                    loop
                    playsInline
                    preload="none"
                    aria-label="출근 확인, 근무표, 급여 검토 흐름을 보여주는 가상 예시 영상"
                    onError={() => setFailed(true)}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                  {showSoundButton ? (
                    <button
                      type="button"
                      onClick={toggleSound}
                      aria-pressed={soundOn}
                      aria-label={soundOn ? "영상 소리 끄기" : "영상 소리 켜기"}
                      className="absolute bottom-3 right-3 z-10 flex min-h-[44px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-foreground-950/70 px-3.5 text-[14px] font-medium text-background-50 transition-colors hover:bg-foreground-950/85"
                    >
                      <i
                        className={`${soundOn ? "ri-volume-up-line" : "ri-volume-mute-line"} text-[18px]`}
                      />
                      {soundOn ? "소리 끄기" : "소리 켜기"}
                    </button>
                  ) : null}
                </div>
                <p className="mt-3 text-center text-[14px] leading-relaxed text-foreground-600 md:text-left">
                  기능 설명을 위한 가상 예시 영상이에요. 실제 저장되는 데이터가 아니에요.
                </p>
              </div>
            </Reveal>

            <Reveal delay={80} className="w-full">
              <SectionLabel>40초 미리보기</SectionLabel>
              <h2 className="mt-4 font-heading text-[26px] font-bold leading-[1.26] tracking-tight text-foreground-950 md:text-[34px]">
                출근부터 월급 정리까지, 40초로 살펴보세요
              </h2>
              <ul className="mt-7 space-y-5">
                {FILM_POINTS.map((point) => (
                  <li key={point.title} className="flex items-start gap-4">
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-md bg-primary-50 text-primary-700">
                      <i className={`${point.icon} text-[22px]`} />
                    </span>
                    <div>
                      <p className="font-heading text-[18px] font-semibold text-foreground-950">
                        {point.title}
                      </p>
                      <p className="mt-1 text-[16px] leading-relaxed text-foreground-700">
                        {point.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <a
                href={EXTERNAL.demo}
                className="mt-8 inline-flex min-h-[56px] items-center gap-2 whitespace-nowrap rounded-md bg-primary-600 px-7 text-[17px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
              >
                무료로 직접 눌러보기
                <i className="ri-arrow-right-line text-[18px]" />
              </a>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}