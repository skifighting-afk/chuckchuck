// 가이드 30: 매장 와이파이가 약할 때 출퇴근 기록을 놓치지 않게 다시 보낸다.
// - 인터넷 오류(요청 자체 실패), 서버 일시 오류(5xx), 동시에 저장돼 생긴 충돌(409)만 다시 보낸다.
// - 움직이는 QR은 찍은 뒤 1분까지만 유효하므로 다시 보내기는 50초 안에서 끝낸다.
// - 다시 보냈는데 "이미 출근"처럼 앞선 요청이 이미 저장된 경우는 성공으로 본다(앞 요청이 도착했지만 응답만 못 받은 경우).
export const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 12000, 15000];
export type Attempt = {ok: boolean; status: number; error?: string; data?: any};
export const retryable = (r: Attempt | null) => !r || r.status >= 500 || r.status === 409 || r.status === 0;
/** 다시 보낸 요청이 "이미 처리됨"으로 돌아오면 앞 요청이 저장된 것 */
export const alreadyDone = (r: Attempt, kind: string) =>
  r.status >= 400 && r.status < 500 && !!r.error && (kind === 'in' ? /이미 출근/.test(r.error) : kind === 'out' ? /출근 기록이 없/.test(r.error) : kind === 'break' ? /이미 휴게/.test(r.error) : false);

export async function sendWithRetry(send: () => Promise<Attempt>, opts: {kind: string; delays?: number[]; wait?: (ms: number) => Promise<void>; onRetry?: (n: number, total: number) => void}) {
  const delays = opts.delays ?? RETRY_DELAYS_MS, wait = opts.wait ?? (ms => new Promise<void>(r => setTimeout(r, ms)));
  let last: Attempt | null = null;
  for (let i = 0; i <= delays.length; i++) {
    if (i > 0) { opts.onRetry?.(i, delays.length); await wait(delays[i - 1]); }
    try { last = await send(); } catch { last = {ok: false, status: 0, error: 'network'}; }
    if (last.ok) return {...last, retried: i};
    if (i > 0 && alreadyDone(last, opts.kind)) return {ok: true, status: 200, retried: i, alreadyDone: true} as Attempt & {retried: number; alreadyDone: boolean};
    if (!retryable(last)) return {...last, retried: i};
  }
  return {...last!, retried: delays.length, gaveUp: true};
}
