import { useCallback, useEffect, useRef, useState } from "react";
import Cheokcheoki from "@/components/base/Cheokcheoki";
import { CHARACTER } from "@/mocks/site";
import { useMotionPreference } from "@/hooks/useMotionPreference";

/**
 * 히어로 오른쪽 척척이 인사 영역.
 * - 원본 척척이 이미지를 poster/fallback으로 깔고, 실제 인사 영상(Higgsfield 제작·5초 무음)을 위에 올린다.
 * - PC 최대 280px · 모바일 128px, 정사각형 object-contain.
 * - muted · autoPlay · playsInline · loop · controls=false. 재생 버튼은 두지 않는다(알아서 움직이는 장식).
 * - 화면 안 + 탭 보임 + 모션 켜짐이면 자동 반복, 밖/숨김이면 정지하고 재진입하면 자동 재개한다.
 * - 자동재생이 거절되면 원본 이미지를 보여주고, 첫 자연스러운 상호작용에서 한 번만 다시 시도한다.
 * - 정지할 때 정지 이미지로 번쩍 전환하지 않는다(영상 프레임을 그대로 유지).
 */
export default function CheokcheokiGreeting() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const observedRef = useRef(false);
  const retriedRef = useRef(false);
  const { motionOff } = useMotionPreference();

  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(true);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(false);

  const tryPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || failed || motionOff) return;
    const result = video.play();
    if (result && typeof result.then === "function") {
      result.then(() => setActive(true)).catch(() => {
        /* 자동재생 거절 → 첫 사용자 상호작용에서 한 번 더 시도한다(별도 버튼은 만들지 않는다). */
      });
    } else {
      setActive(true);
    }
  }, [failed, motionOff]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  // 화면에 들어왔는지 확인한다.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      observedRef.current = true;
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          observedRef.current = true;
          setInView(entry.isIntersecting);
        }),
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 탭이 보이는지 확인한다.
  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // 화면 안 + 탭 보임 + 모션 켜짐이면 재생(재진입 시 자동 재개), 아니면 정지.
  useEffect(() => {
    if (!observedRef.current) return;
    if (inView && visible && !motionOff && !failed) tryPlay();
    else pause();
  }, [inView, visible, motionOff, failed, tryPlay, pause]);

  // 자동재생이 거절된 경우, 첫 자연스러운 상호작용에서 한 번만 다시 시도한다.
  useEffect(() => {
    const retry = () => {
      if (retriedRef.current) return;
      retriedRef.current = true;
      tryPlay();
    };
    const events = ["pointerdown", "touchstart", "keydown", "wheel", "scroll"] as const;
    events.forEach((event) =>
      window.addEventListener(event, retry, { once: true, passive: true }),
    );
    return () => events.forEach((event) => window.removeEventListener(event, retry));
  }, [tryPlay]);

  return (
    <div className="char-in flex w-full flex-col items-center lg:items-end">
      <div className="speech-bubble relative mb-4 max-w-[230px] rounded-lg border border-background-200 bg-background-50 px-4 py-3 lg:mr-7">
        <p className="font-heading text-[15px] font-semibold leading-snug text-foreground-900">
          {CHARACTER.greeting}
        </p>
      </div>

      <div
        ref={boxRef}
        className="relative h-[128px] w-[128px] overflow-hidden rounded-lg bg-background-100 sm:h-[190px] sm:w-[190px] lg:mr-3 lg:h-[280px] lg:w-[280px]"
      >
        {/* 원본 척척이 이미지 = poster / fallback. 영상이 준비되지 않았거나 실패하면 이 그림이 그대로 보인다. */}
        <div className="absolute inset-0">
          <Cheokcheoki />
        </div>
        {!failed ? (
          <video
            ref={videoRef}
            src={CHARACTER.heroVideoUrl}
            poster={CHARACTER.image}
            muted
            autoPlay
            playsInline
            loop
            controls={false}
            preload="metadata"
            aria-label={`${CHARACTER.alt} 인사 영상`}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ${
              active && !motionOff ? "opacity-100" : "opacity-0"
            }`}
            onPlaying={() => setActive(true)}
            onError={() => {
              setFailed(true);
              setActive(false);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}