// 화면의 fetch('/api/...')를 Supabase Edge Function으로 보내고, 로그인 토큰을 붙인다.
// 화면 코드는 예전처럼 '/api/...'만 부르면 된다.
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;
const SUPABASE = __SUPABASE_URL__.replace(/\/$/, '');
const ANON = __SUPABASE_ANON_KEY__;
const KEY = 'cheok-session';
type Session = {access_token: string; refresh_token: string; expires_at: number};

const original = window.fetch.bind(window);
let current: Session | null = load();
// 지시서 109: 카카오 간편 로그인(Supabase OAuth) — 돌아온 주소의 #access_token을 세션으로 저장
try {
  const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.slice(1));
  if (q.get('oauth') === 'kakao' && h.get('access_token') && h.get('refresh_token')) {
    save({access_token: h.get('access_token')!, refresh_token: h.get('refresh_token')!, expires_at: Number(h.get('expires_at')) || Math.floor(Date.now() / 1000) + (Number(h.get('expires_in')) || 3600)});
    q.delete('oauth'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
  }
} catch {}
declare const __KAKAO_LOGIN__: boolean;
// 스토어 앱 안에서는 카카오 로그인을 숨긴다(앱 심사: 소셜 로그인을 넣으면 애플 로그인도 필요, 돌아오는 주소도 앱에서 못 받음)
export const kakaoLoginEnabled = typeof __KAKAO_LOGIN__ !== 'undefined' && __KAKAO_LOGIN__ && !(typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.());
export const kakaoLoginUrl = (next = '/app') => SUPABASE + '/auth/v1/authorize?provider=kakao&redirect_to=' + encodeURIComponent(location.origin + next + (next.includes('?') ? '&' : '?') + 'oauth=kakao');
let refreshing: Promise<void> | null = null;

function load(): Session | null { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
function save(s: Session | null) { current = s; try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch {} }

async function fresh() {
  if (!current) return null;
  if (current.expires_at * 1000 - Date.now() > 60_000) return current;
  refreshing ||= (async () => {
    try {
      const r = await original(SUPABASE + '/auth/v1/token?grant_type=refresh_token', {method: 'POST', headers: {apikey: ANON, 'Content-Type': 'application/json'}, body: JSON.stringify({refresh_token: current!.refresh_token})});
      const d: any = await r.json().catch(() => ({}));
      if (r.ok && d.access_token) save({access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (Number(d.expires_in) || 3600)});
      else if (r.status >= 400 && r.status < 500) save(null);
    } catch {}
  })().finally(() => { refreshing = null; });
  await refreshing;
  return current;
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = url.startsWith(location.origin) ? url.slice(location.origin.length) : url;
  if (!path.startsWith('/api/') && path !== '/api') return original(input, init);
  const s = await fresh();
  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  headers.set('apikey', ANON);
  headers.set('Authorization', 'Bearer ' + (s?.access_token || ANON));
  const t0 = performance.now();
  const res = await original(SUPABASE + '/functions/v1' + path, {...init, method: init?.method || (input instanceof Request ? input.method : 'GET'), headers, credentials: 'omit'});
  // 개선 2차 B198: 2초 넘게 걸린 요청은 주소(물음표 뒤 빼고)와 걸린 시간만 남긴다
  const ms = Math.round(performance.now() - t0); if (ms > 2000 && !path.startsWith('/api/client-error')) reportClient('slow', `${(init?.method || 'GET').toUpperCase()} ${path.replace(/[?#].*$/, '')} ${ms}ms`);
  if (path.startsWith('/api/auth') && (init?.method || 'GET').toUpperCase() === 'POST') {
    const d: any = await res.clone().json().catch(() => null);
    if (d && typeof d === 'object' && 'session' in d) save(d.session);
  }
  return res;
};

/** 로그인되어 있는지(토큰이 있는지) — 화면 분기용 */
export const hasSession = () => !!current;

/** 개선 2차 B196·B198: 화면 오류·느린 요청 보고(한 화면에 10번까지, 개인정보는 서버에서 한 번 더 지움) */
let reported = 0;
export function reportClient(kind: 'error' | 'slow', message: string) {
  const m = String(message || '');
  // 정보가 없는 외부 스크립트 오류("Script error.")는 보내지 않는다
  // 로그인한 화면에서만 보낸다(가입·로그인 같은 공개 화면에서는 보내지 않음 — 배포 점검에서 이 요청이 끝나지 않는 일이 있었음)
  if (!current || reported >= 10 || /^\/(demo|try|signup|login|start|pricing)?$/.test(location.pathname) || /^\/(demo|try)/.test(location.pathname) || /^Script error\.?\s*@/.test(m)) return;
  reported++;
  // 화면 사용을 방해하지 않게: 화면이 조용해진 뒤(최대 5초 뒤) 보내고, 3초 안에 끝나지 않으면 끊는다
  const send = () => { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 3000); void window.fetch('/api/client-error', {method: 'POST', signal: c.signal, headers: {'Content-Type': 'application/json'}, body: JSON.stringify({kind, message: m.slice(0, 600), path: location.pathname})}).catch(() => null).finally(() => clearTimeout(t)); } catch {} };
  try { const ric = (window as any).requestIdleCallback; if (ric) ric(send, {timeout: 5000}); else setTimeout(send, 3000); } catch { setTimeout(send, 3000); }
}
try {
  addEventListener('error', (e: Event) => { if ((e as ErrorEvent).message) reportClient('error', `${(e as ErrorEvent).message} @${String((e as ErrorEvent).filename || '').split('/').pop()}:${(e as ErrorEvent).lineno}`); });
  addEventListener('unhandledrejection', (e: Event) => { const r: any = (e as PromiseRejectionEvent).reason; reportClient('error', 'promise: ' + String(r?.message || r).slice(0, 300)); });
} catch {}
