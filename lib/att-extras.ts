// 지시서 '다음' 출퇴근 묶음: 006 위치 확인 · 007 한 휴대폰 여러 명 출근 · 015 휴게 위치 · 016 상태 필터 · 018 기간 내려받기 · 019 월간 근태 달력 · 005 연장 승인 대기
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
type Att = {id: string; employeeId: string; start: string; end: string | null; breakMinutes: number; device?: string; geo?: {ok: boolean; m: number}; breaks?: {start: string; end: string}[]; source?: string; credit?: {start: string; end: string} | null; otApproved?: {by: string; at: string} | null};
const kd = (iso: string) => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 10);
const kt = (iso: string) => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(11, 16);

/** 006: 두 좌표 사이 거리(미터) */
export function distM(a: {lat: number; lng: number}, b: {lat: number; lng: number}) {
  const R = 6371000, r = (d: number) => d * Math.PI / 180;
  const x = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(x))));
}
export type Geo = {lat: number; lng: number; radius: number; mode: 'warn' | 'block'};
/** 006: 찍은 위치 판정 — 정확도(acc)는 100m까지만 너그럽게 봐 준다. 위치가 없으면 ok:false, m:-1 */
export function geoCheck(g: Geo | undefined, p: {lat?: unknown; lng?: unknown; acc?: unknown}) {
  if (!g) return null;
  const lat = Number(p.lat), lng = Number(p.lng), acc = Math.min(100, Math.max(0, Number(p.acc) || 0));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return {ok: false, m: -1};
  const m = distM(g, {lat, lng});
  return {ok: m <= g.radius + acc, m};
}
export const geoText = (x?: {ok: boolean; m: number}) => !x ? '' : x.m < 0 ? '위치 확인 안 됨' : x.ok ? `매장 근처(${x.m}m)` : `매장에서 ${x.m >= 1000 ? (x.m / 1000).toFixed(1) + 'km' : x.m + 'm'} 떨어진 곳`;

/** 007: 같은 날 한 휴대폰으로 서로 다른 직원 2명 이상이 출근 */
export function sharedDevices(att: Att[], date: string) {
  const by = new Map<string, Set<string>>();
  for (const a of att) if (a.device && a.device !== 'kiosk' && kd(a.start) === date) { const s = by.get(a.device) || new Set(); s.add(a.employeeId); by.set(a.device, s) }
  return [...by.entries()].filter(([, s]) => s.size >= 2).map(([device, s]) => ({device, employeeIds: [...s]}));
}

/** 015: 휴게 구간(끝난 것만). 예전 기록은 구간이 없어 빈 배열 */
export const breakSpans = (a: Att) => (a.breaks || []).filter(b => Date.parse(b.end) > Date.parse(b.start)).map(b => [Date.parse(b.start), Date.parse(b.end)] as const);

/** 005: 퇴근이 예정보다 늦었는데 승인 전이라 예정 시각까지만 인정된 분 */
export function pendingOvertime(a: Att) {
  if (!a.end || !a.credit || a.otApproved) return 0;
  const cut = Math.round((Date.parse(a.end) - Date.parse(a.credit.end)) / 60000);
  return cut >= 1 ? cut : 0;
}

/** 016: 상태 필터 */
export const FILTERS = ['전체', '지각', '조퇴', '미퇴근', '결근·미출근', '예정 외', '위치 확인'] as const;
export type Filter = typeof FILTERS[number];
export function rowMatches(statuses: {kind: string}[], records: Att[], f: Filter) {
  if (f === '전체') return true;
  if (f === '결근·미출근') return statuses.some(x => x.kind === '결근' || x.kind === '미출근');
  if (f === '위치 확인') return records.some(a => a.geo && !a.geo.ok);
  return statuses.some(x => x.kind === f);
}

/** 018: 기간별 원본 출퇴근 기록(엑셀 시트 한 장) */
export function rangeRows(att: Att[], names: Record<string, string>, from: string, to: string) {
  const hrs = (a: Att) => a.end ? Math.round(Math.max(0, (Date.parse(a.end) - Date.parse(a.start)) / 3600000 - a.breakMinutes / 60) * 100) / 100 : '';
  const paid = (a: Att) => a.end && a.credit ? Math.round(Math.max(0, (Date.parse(a.credit.end) - Date.parse(a.credit.start)) / 3600000 - a.breakMinutes / 60) * 100) / 100 : hrs(a);
  const list = att.filter(a => names[a.employeeId] !== undefined && kd(a.start) >= from && kd(a.start) <= to).sort((a, b) => a.start.localeCompare(b.start));
  return [['날짜', '직원', '출근(찍은 시각)', '퇴근(찍은 시각)', '휴게(분)', '휴게 구간', '찍은 시간(시간)', '인정 시간(시간)', '입력', '위치'],
    ...list.map(a => [kd(a.start), names[a.employeeId], kt(a.start), a.end ? (kd(a.end) !== kd(a.start) ? kd(a.end) + ' ' : '') + kt(a.end) : '근무 중', Math.round(a.breakMinutes), (a.breaks || []).map(b => kt(b.start) + '–' + kt(b.end)).join(', '), hrs(a), paid(a), a.source === 'owner' ? '사장님 입력' : '직원', geoText(a.geo)])];
}

/** 019: 월간 근태 달력 칸 — 글자로도 구분(색만으로 구분하지 않게) */
export const CAL_MARK: Record<string, string> = {정상: '○', 지각: '지', 조퇴: '조', 결근: '✕', 미출근: '✕', 미퇴근: '!', '예정 외': '＋', 휴가: '휴', '휴게 중': '○', '출근 전': '·'};
export function calCell(statuses: {kind: string}[]) {
  const order = ['결근', '미출근', '미퇴근', '지각', '조퇴', '휴가', '예정 외', '정상', '휴게 중', '출근 전'];
  const k = order.find(o => statuses.some(x => x.kind === o));
  return k ? {kind: k, mark: CAL_MARK[k]} : null;
}
