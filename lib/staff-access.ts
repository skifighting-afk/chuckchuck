// 지시서 5주차 123: 퇴사 처리한 직원은 퇴사일(endDate)이 지나면 자동으로 접속이 막힌다. 퇴사일이 없으면 바로 막는다.
export const kstToday = (now = Date.now()) => new Date(now + 9 * 3600000).toISOString().slice(0, 10);
export function staffGone(e: {status?: string; endDate?: string} | null | undefined, today = kstToday()) {
  if (!e) return true;
  if (e.status !== '퇴사') return false;
  return !e.endDate || !/^\d{4}-\d{2}-\d{2}$/.test(e.endDate) || e.endDate < today;
}
