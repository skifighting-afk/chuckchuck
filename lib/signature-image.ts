// 작업 039: 손서명 이미지 — PNG data URL만, 크기 제한, 서명 기록에 해시와 함께 보관
export const MAX_DRAWING = 60000;
export function checkDrawing(v: unknown): {ok: true; value: string | null} | {ok: false; error: string} {
  if (v === undefined || v === null || v === '') return {ok: true, value: null};
  if (typeof v !== 'string' || !v.startsWith('data:image/png;base64,')) return {ok: false, error: '손서명 이미지를 다시 그려 주세요.'};
  const b64 = v.slice(22);
  if (b64.length > MAX_DRAWING) return {ok: false, error: '손서명 이미지가 너무 커요. 지우고 다시 그려 주세요.'};
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return {ok: false, error: '손서명 이미지를 다시 그려 주세요.'};
  const head = atob(b64.slice(0, 12));
  if (head.slice(0, 8) !== '\x89PNG\r\n\x1a\n') return {ok: false, error: '손서명 이미지를 다시 그려 주세요.'};
  return {ok: true, value: v};
}
