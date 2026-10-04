import { useCallback, useEffect, useState } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

const STORAGE_KEY = "cheokcheoki-motion-off";
const EVENT = "cheokcheoki-motion-change";

/** 브라우저 최상위 요소에 전역 모션 끄기 상태를 반영한다(히어로 영상 + 제품 모션 공통). */
function applyMotionClass(off: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("motion-off", off);
}

interface MotionPreference {
  /** 실제로 모션을 꺼야 하는지 (사용자 선택 또는 기기 설정) */
  motionOff: boolean;
  /** 기기에서 "움직임 줄이기"를 켜 두었는지 */
  reduced: boolean;
  /** 사용자가 직접 끄기/켜기 (저장됨) */
  setMotionOff: (next: boolean) => void;
  toggleMotion: () => void;
}

/**
 * 브랜드 모션 켜기/끄기 상태.
 * - 사용자가 끈 상태는 브라우저에 저장해 다음 방문에도 유지한다.
 * - 기기에서 "움직임 줄이기(prefers-reduced-motion)"를 켜 두면 항상 정적으로 보여준다.
 * - 히어로 영상과 제품체험 모션이 같은 설정을 함께 쓰도록, 여러 곳에서 쓸 때에도 값이 자동으로 동기화된다.
 */
export function useMotionPreference(): MotionPreference {
  const reduced = usePrefersReducedMotion();
  const [storedOff, setStoredOff] = useState(false);

  useEffect(() => {
    let initial = false;
    try {
      initial = window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      /* 저장 공간을 쓸 수 없으면 기본값(모션 켜짐)으로 보여줘요 */
    }
    setStoredOff(initial);
    applyMotionClass(initial);
  }, []);

  // 다른 영역(히어로 ↔ 제품체험)에서 상태가 바뀌면 이 훅도 함께 따라간다.
  useEffect(() => {
    const onChange = (event: Event) => {
      const next = Boolean((event as CustomEvent<boolean>).detail);
      setStoredOff(next);
      applyMotionClass(next);
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const setMotionOff = useCallback((next: boolean) => {
    setStoredOff(next);
    applyMotionClass(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* 저장할 수 없으면 화면 상태만 유지해요 */
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent<boolean>(EVENT, { detail: next }));
    }
  }, []);

  const toggleMotion = useCallback(() => {
    setMotionOff(!storedOff);
  }, [setMotionOff, storedOff]);

  return { motionOff: storedOff || reduced, reduced, setMotionOff, toggleMotion };
}