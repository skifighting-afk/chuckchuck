// 작업 007: 서버 오류 수집. Supabase 함수 로그(Edge Functions → Logs)에 한 줄 JSON으로 남기고,
// 사용자에게는 오류 번호만 보여 줘서 문의할 때 로그를 찾을 수 있게 한다.
// 개인정보는 남기지 않는다: 이메일, 긴 숫자(전화·계좌 등), UUID, 따옴표·괄호 안 값(DB 오류의 실제 값)은 지운다.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newErrorId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return 'E-' + [...bytes].map(b => ALPHABET[b % ALPHABET.length]).join('');
}
export function scrub(text: string) {
  return text
    .replace(/[^\s@'"()]+@[^\s@'"()]+/g, '[email]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]')
    .replace(/native:[^\s'")]+/g, '[user]')
    .replace(/=\([^)]*\)/g, '=(…)')
    .replace(/'[^']*'|"[^"]*"/g, '…')
    .replace(/\d{5,}/g, '[num]')
    .slice(0, 300);
}
/** 오류를 로그에 남기고 오류 번호를 돌려준다. */
export function reportError(where: string, error: unknown, id = newErrorId()) {
  const e = error as any;
  const line = {level: 'error', errorId: id, where, name: e?.name || typeof error, code: typeof e?.code === 'string' ? e.code : undefined, message: scrub(String(e?.message ?? error ?? '')), at: new Date().toISOString()};
  console.error(JSON.stringify(line));
  return id;
}
/** 500 응답: 다음 행동 + 오류 번호 */
export function serverError(where: string, error: unknown, message = '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.', status = 500) {
  const id = reportError(where, error);
  return Response.json({error: `${message} 계속되면 오류 번호 ${id}를 알려 주세요.`, errorId: id}, {status, headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
}
