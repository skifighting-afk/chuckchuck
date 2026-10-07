// 지시서 1라운드 D: 매장 매뉴얼 — 분류·대상(업무)·검색·바뀜 표시 규칙. 서버·화면·체험 화면이 같이 쓴다.
export const MANUAL_CATEGORIES = ['오픈', '마감', '기기', '위생', '기타'] as const;
export type ManualCategory = typeof MANUAL_CATEGORIES[number];
export type ManualLike = {id: string; title: string; branchId: string; category?: string; roles?: string[]; steps: {text: string}[]; createdAt?: string; updatedAt: string; note?: string};

/** 이 직원(지점·업무)에게 보이는 매뉴얼인지 */
export function manualVisibleTo(m: ManualLike, emp: {branchId?: string; role?: string} | null | undefined) {
  if (!emp) return false;
  const branchOk = m.branchId === 'all' || m.branchId === emp.branchId;
  const roleOk = !m.roles || !m.roles.length || m.roles.includes(emp.role || '');
  return branchOk && roleOk;
}
export const audienceLabel = (m: {roles?: string[]}) => !m.roles || !m.roles.length ? '모든 직원' : m.roles.join('·') + ' 직원';
export const audienceLine = (m: {roles?: string[]}) => !m.roles || !m.roles.length ? '모든 직원에게 보여요' : `${m.roles.join('·')} 직원에게만 보여요`;
/** 고친 적이 있는 매뉴얼인지(처음 만든 뒤 수정) */
export const wasEdited = (m: ManualLike) => !!m.createdAt && m.updatedAt > m.createdAt;
/** 직원이 볼 상태: 새 매뉴얼 / 바뀜 / 확인함 */
export const staffState = (m: ManualLike & {read?: boolean}) => m.read ? '확인함' : wasEdited(m) ? '바뀜' : '새 매뉴얼';

/** 분류 칩 + 검색어로 거르기(제목·단계 글·분류에서 찾기) */
export function filterManuals<T extends ManualLike>(list: T[], category: string, query: string) {
  const q = query.trim().toLowerCase();
  return list.filter(m => (category === '전체' || (m.category || '기타') === category) &&
    (!q || m.title.toLowerCase().includes(q) || (m.category || '').includes(q) || m.steps.some(s => s.text.toLowerCase().includes(q))));
}
export function categoryCounts(list: ManualLike[]) {
  const c: Record<string, number> = {전체: list.length};
  for (const k of MANUAL_CATEGORIES) c[k] = list.filter(m => (m.category || '기타') === k).length;
  return c;
}
