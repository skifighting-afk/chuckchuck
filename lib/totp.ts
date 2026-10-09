// 지시서 098: 2단계 인증(인증 앱 6자리, RFC 6238 TOTP · 30초 · SHA-1) — 라이브러리 없이 WebCrypto로.
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes: Uint8Array) { let bits = 0, v = 0, out = ''; for (const b of bytes) { v = (v << 8) | b; bits += 8; while (bits >= 5) { out += A[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += A[(v << (5 - bits)) & 31]; return out; }
export function unbase32(s: string) { const t = s.toUpperCase().replace(/[\s=-]/g, ''); let bits = 0, v = 0; const out: number[] = []; for (const c of t) { const i = A.indexOf(c); if (i < 0) throw Error('bad base32'); v = (v << 5) | i; bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return new Uint8Array(out); }
export async function hotp(secret: Uint8Array, counter: number, digits = 6) {
  const msg = new Uint8Array(8); let c = counter; for (let i = 7; i >= 0; i--) { msg[i] = c & 255; c = Math.floor(c / 256); }
  const key = await crypto.subtle.importKey('raw', secret as unknown as ArrayBuffer, {name: 'HMAC', hash: 'SHA-1'}, false, ['sign']);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg)), o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** digits).padStart(digits, '0');
}
/** 앞뒤 30초까지 허용. 맞으면 쓴 시간 칸(counter)을, 틀리면 -1 — 같은 칸을 두 번 쓰지 못하게 마지막 칸을 저장해 두고 비교한다 */
export async function verifyTotp(secretB32: string, code: string, now = Date.now(), lastStep = -1) {
  if (!/^\d{6}$/.test(code)) return -1; const s = unbase32(secretB32), t = Math.floor(now / 30000);
  for (const d of [0, -1, 1]) { const step = t + d; if (step <= lastStep) continue; if (await hotp(s, step) === code) return step; }
  return -1;
}
export const newSecret = () => base32(crypto.getRandomValues(new Uint8Array(20)));
export const otpauthUri = (secret: string, account: string, issuer = '척척사장') => `otpauth://totp/${encodeURIComponent(issuer + ':' + account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
/** 비상 코드 10개(한 번씩만) — 휴대폰을 잃어버렸을 때 */
export const backupCodes = () => Array.from({length: 10}, () => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join(''));
/** 세션 구분값: JWT의 session_id(갱신해도 같음), 읽을 수 없으면 토큰 해시용 원문 */
export function sessionKeyOf(token: string) {
  try { const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); if (typeof p.session_id === 'string' && p.session_id) return 'sid:' + p.session_id; } catch {}
  return 'tok:' + token;
}
