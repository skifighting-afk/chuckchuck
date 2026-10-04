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
  const res = await original(SUPABASE + '/functions/v1' + path, {...init, method: init?.method || (input instanceof Request ? input.method : 'GET'), headers, credentials: 'omit'});
  if (path.startsWith('/api/auth') && (init?.method || 'GET').toUpperCase() === 'POST') {
    const d: any = await res.clone().json().catch(() => null);
    if (d && typeof d === 'object' && 'session' in d) save(d.session);
  }
  return res;
};

/** 로그인되어 있는지(토큰이 있는지) — 화면 분기용 */
export const hasSession = () => !!current;
