// 메타(페이스북·인스타) 광고 성과 재기: 픽셀 ID가 deploy.config.json의 META_PIXEL_ID에 있을 때만 켜진다.
// 로그인 전 공개 화면(첫 화면·요금·계산기·도움말·시작·가입·로그인·체험)에서만 방문을 재고,
// 가게 만들기(무료 체험 시작)가 끝나면 '가입 완료(CompleteRegistration)'를 한 번 보낸다.
// 가게 안 화면(근무표·급여·직원 정보)에는 절대 싣지 않는다. 이름·전화·메일 같은 개인정보는 보내지 않는다.
declare const __META_PIXEL_ID__: string;
const ID = typeof __META_PIXEL_ID__ !== 'undefined' && /^\d{15,16}$/.test(__META_PIXEL_ID__) ? __META_PIXEL_ID__ : '';
const PUBLIC_PATH = /^\/(pricing|calculator|help|start|signup|login|demo)?\/?$/;

type Fbq = ((...args: unknown[]) => void) & {queue?: unknown[][]; callMethod?: (...a: unknown[]) => void; loaded?: boolean; version?: string; push?: unknown};
let started = false;

function start() {
  if (!ID || started) return started;
  const w = window as unknown as {fbq?: Fbq; _fbq?: Fbq};
  if (!w.fbq) {
    // 메타 안내 코드와 같은 대기열. 인라인 스크립트를 못 쓰는 보안 정책(CSP) 때문에 여기서 만든다.
    const q: Fbq = (...args: unknown[]) => { q.callMethod ? q.callMethod(...args) : q.queue!.push(args); };
    q.queue = []; q.loaded = true; q.version = '2.0'; q.push = q;
    w.fbq = q; w._fbq = q;
    const s = document.createElement('script');
    s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
  }
  w.fbq!('init', ID);
  started = true;
  return true;
}

/** 공개 화면 방문을 잰다. 가게 안 화면에서는 아무것도 하지 않는다. */
export function trackPageView() {
  if (!ID || !PUBLIC_PATH.test(location.pathname)) return;
  if (start()) (window as unknown as {fbq: Fbq}).fbq('track', 'PageView');
}

/** 가게를 만들어 무료 체험을 시작했을 때 한 번. 보낼 틈을 조금 준 뒤 다음 화면으로 넘어간다. */
export function trackSignupThen(plan: string, go: () => void) {
  if (!ID || !start()) { go(); return; }
  (window as unknown as {fbq: Fbq}).fbq('track', 'CompleteRegistration', {content_name: plan, status: true, currency: 'KRW', value: 0});
  setTimeout(go, 600);
}

export const metaPixelEnabled = !!ID;
