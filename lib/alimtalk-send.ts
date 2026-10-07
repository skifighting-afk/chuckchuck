// 지시서 2주차 032: 카카오 알림톡 실제 발송(솔라피 API). 비즈 채널·템플릿 심사가 끝나고 아래 값을 서버 비밀값으로 넣으면 켜진다.
//   SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_PFID(카카오 채널 ID), SOLAPI_SENDER(발신 번호),
//   ALIMTALK_TEMPLATES = {"PAYSLIP_SENT":"KA01TP...","CLOCKOUT_MISSING":"KA01TP...", ...} (심사 통과한 템플릿 ID)
// 값이 없으면 보내지 않고(null) 앱 알림만 간다. 실패해도 본래 작업은 막지 않는다.
import type {TemplateId} from './alimtalk';
export type AlimtalkEnv = {SOLAPI_API_KEY?: string; SOLAPI_API_SECRET?: string; SOLAPI_PFID?: string; SOLAPI_SENDER?: string; ALIMTALK_TEMPLATES?: string};
export function alimtalkReady(env: AlimtalkEnv, id?: TemplateId) {
  if (!env.SOLAPI_API_KEY || !env.SOLAPI_API_SECRET || !env.SOLAPI_PFID || !env.SOLAPI_SENDER || !env.ALIMTALK_TEMPLATES) return false;
  if (!id) return true;
  try { return !!JSON.parse(env.ALIMTALK_TEMPLATES)[id]; } catch { return false; }
}
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
async function authHeader(key: string, secret: string) {
  const date = new Date().toISOString(), salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  const sig = hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(date + salt)));
  return `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${sig}`;
}
/** 알림톡 한 건. 반환: 'sent' | 'failed' | null(설정 없음·번호 없음) */
export async function sendAlimtalk(env: AlimtalkEnv, to: string | null | undefined, id: TemplateId, vars: Record<string, string | number>, fetcher: typeof fetch = fetch) {
  const phone = (to || '').replace(/\D/g, '');
  if (!alimtalkReady(env, id) || !/^01\d{8,9}$/.test(phone) || phone === '01000000000') return null;
  try {
    const templateId = JSON.parse(env.ALIMTALK_TEMPLATES!)[id];
    if (Object.values(vars).some(v => v === undefined || v === '')) return 'failed' as const;
    const variables = Object.fromEntries(Object.entries(vars).map(([k, v]) => [`#{${k}}`, String(v)]));
    const r = await fetcher('https://api.solapi.com/messages/v4/send', {method: 'POST', headers: {Authorization: await authHeader(env.SOLAPI_API_KEY!, env.SOLAPI_API_SECRET!), 'Content-Type': 'application/json'},
      body: JSON.stringify({message: {to: phone, from: env.SOLAPI_SENDER, kakaoOptions: {pfId: env.SOLAPI_PFID, templateId, variables}}}), signal: AbortSignal.timeout(8000)});
    return r.ok ? 'sent' as const : 'failed' as const;
  } catch { return 'failed' as const; }
}
