// 스토어 앱 알림 보내기: 안드로이드는 FCM(HTTP v1), 아이폰은 APNs(토큰 인증 .p8).
// 키는 서버 함수 비밀값(FCM_SERVICE_ACCOUNT, APNS_KEY·APNS_KEY_ID·APNS_TEAM_ID)으로만 들어온다. 없으면 보내지 않는다.
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
export type NativeEnv = {FCM_SERVICE_ACCOUNT?: string; APNS_KEY?: string; APNS_KEY_ID?: string; APNS_TEAM_ID?: string; APNS_BUNDLE_ID?: string; APNS_SANDBOX?: string};
export type Msg = {title: string; body: string; url: string};
const b64u = (b: ArrayBuffer | Uint8Array | string) => { const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b as ArrayBuffer); let s = ''; for (const x of bytes) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const pemBody = (pem: string) => Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0));

export async function signJwt(alg: 'RS256' | 'ES256', pem: string, header: Record<string, unknown>, payload: Record<string, unknown>) {
  const key = await crypto.subtle.importKey('pkcs8', pemBody(pem), alg === 'RS256' ? {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'} : {name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign']);
  const input = b64u(JSON.stringify({alg, typ: 'JWT', ...header})) + '.' + b64u(JSON.stringify(payload));
  const sig = await crypto.subtle.sign(alg === 'RS256' ? {name: 'RSASSA-PKCS1-v1_5'} : {name: 'ECDSA', hash: 'SHA-256'}, key, new TextEncoder().encode(input));
  return input + '.' + b64u(sig);
}

let fcmCache: {token: string; exp: number} | null = null;
export async function fcmAccessToken(sa: {client_email: string; private_key: string; token_uri?: string}, fetcher: typeof fetch = fetch, now = Date.now()) {
  if (fcmCache && fcmCache.exp - 60000 > now) return fcmCache.token;
  const iat = Math.floor(now / 1000), aud = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const assertion = await signJwt('RS256', sa.private_key, {}, {iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud, iat, exp: iat + 3600});
  const r = await fetcher(aud, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion}).toString()});
  const d: any = await r.json().catch(() => ({})); if (!r.ok || !d.access_token) throw Error('fcm auth ' + r.status);
  fcmCache = {token: d.access_token, exp: now + (Number(d.expires_in) || 3600) * 1000}; return d.access_token as string;
}
export const resetFcmCache = () => { fcmCache = null; };

/** 결과: sent(보냄) · gone(앱이 지워졌거나 토큰이 바뀜 → 지우기) · failed · skipped(키 없음) */
export async function sendNative(env: NativeEnv, t: {token: string; platform: string}, m: Msg, fetcher: typeof fetch = fetch): Promise<'sent' | 'gone' | 'failed' | 'skipped'> {
  const title = m.title.slice(0, 120), body = m.body.slice(0, 240), url = m.url || '/app';
  if (t.platform === 'android') {
    if (!env.FCM_SERVICE_ACCOUNT) return 'skipped';
    const sa = JSON.parse(env.FCM_SERVICE_ACCOUNT), access = await fcmAccessToken(sa, fetcher);
    const r = await fetcher(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(sa.project_id)}/messages:send`, {method: 'POST', headers: {Authorization: 'Bearer ' + access, 'Content-Type': 'application/json'}, body: JSON.stringify({message: {token: t.token, notification: {title, body}, data: {url}, android: {priority: 'high', notification: {sound: 'default'}}}})});
    if (r.ok) return 'sent';
    const d: any = await r.json().catch(() => ({})); const code = d?.error?.details?.find?.((x: any) => x.errorCode)?.errorCode || d?.error?.status;
    return r.status === 404 || code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT' && /token/i.test(d?.error?.message || '') ? 'gone' : 'failed';
  }
  if (t.platform === 'ios') {
    if (!env.APNS_KEY || !env.APNS_KEY_ID || !env.APNS_TEAM_ID) return 'skipped';
    const jwt = await signJwt('ES256', env.APNS_KEY, {kid: env.APNS_KEY_ID}, {iss: env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000)});
    const host = env.APNS_SANDBOX === '1' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
    const r = await fetcher(`https://${host}/3/device/${encodeURIComponent(t.token)}`, {method: 'POST', headers: {authorization: 'bearer ' + jwt, 'apns-topic': env.APNS_BUNDLE_ID || 'kr.chukchukapp.app', 'apns-push-type': 'alert', 'apns-priority': '10', 'content-type': 'application/json'}, body: JSON.stringify({aps: {alert: {title, body}, sound: 'default'}, url})});
    if (r.ok) return 'sent';
    const d: any = await r.json().catch(() => ({}));
    return r.status === 410 || d?.reason === 'BadDeviceToken' || d?.reason === 'Unregistered' ? 'gone' : 'failed';
  }
  return 'failed';
}
export const validNativeToken = (token: unknown, platform: unknown) => typeof token === 'string' && (platform === 'ios' ? /^[0-9a-fA-F]{64,200}$/.test(token) : platform === 'android' ? /^[A-Za-z0-9:_\-.]{20,4096}$/.test(token) : false);
