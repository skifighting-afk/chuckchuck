import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "cheokcheoki-large-text";
const EVENT = "cheokcheoki-text-size-change";

/** 문서 최상위 요소에 "글씨 크게" 상태를 반영한다(사이트 전체가 같은 값을 공유). */
function applyLarge(large: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("text-large", large);
}

interface TextSizePreference {
  large: boolean;
  setLarge: (next: boolean) => void;
  toggle: () => void;
}

/**
 * "글씨 크게 보기" 설정.
 * - 푸터의 작은 버튼 하나로만 조작하고, 제품체험 본문 영역은 차지하지 않는다.
 * - 켠 상태는 브라우저에 저장해 다음 방문에도 유지하고, 여러 곳에서 값이 자동으로 동기화된다.
 */
export function useTextSize(): TextSizePreference {
  const [large, setLargeState] = useState(false);

  useEffect(() => {
    let initial = false;
    try {
      initial = window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      /* 저장 공간을 쓸 수 없으면 기본(보통 크기)으로 보여줘요 */
    }
    setLargeState(initial);
    applyLarge(initial);
  }, []);

  useEffect(() => {
    const onChange = (event: Event) => {
      const next = Boolean((event as CustomEvent<boolean>).detail);
      setLargeState(next);
      applyLarge(next);
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const setLarge = useCallback((next: boolean) => {
    setLargeState(next);
    applyLarge(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* 저장할 수 없으면 화면 상태만 유지해요 */
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent<boolean>(EVENT, { detail: next }));
    }
  }, []);

  const toggle = useCallback(() => setLarge(!large), [setLarge, large]);

  return { large, setLarge, toggle };
}