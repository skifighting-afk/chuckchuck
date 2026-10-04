// 근로기준법 점검 도우미. 화면에서 경고만 하고 저장을 막지는 않는다(실제 판단은 사장님 몫).

/** 근로기준법 제54조: 근로시간이 4시간이면 30분 이상, 8시간이면 1시간 이상 휴게를 근로시간 도중에 준다. */
export const requiredBreak = (workMinutes: number) => (workMinutes >= 480 ? 60 : workMinutes >= 240 ? 30 : 0);

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

/** 근무표 한 칸(HH:MM~HH:MM, 휴게 분)의 휴게 부족 안내. 문제가 없으면 null. 퇴근이 이르면 다음 날 퇴근. */
export function shiftBreakIssue(start: string, end: string, breakMinutes: number) {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  let span = toMin(end) - toMin(start); if (span <= 0) span += 1440;
  const brk = Math.max(0, Number(breakMinutes) || 0), work = span - brk, need = requiredBreak(work);
  return brk < need ? `근로시간 ${(work / 60).toFixed(1).replace(/\.0$/, '')}시간에는 휴게 ${need}분 이상이 필요해요(근로기준법 제54조). 지금 ${brk}분이에요.` : null;
}

/** 실제 출퇴근 기록 중 휴게가 법정 기준보다 짧은 건수 */
export function attendanceBreakShortfalls(records: {start: string; end: string | null; breakMinutes: number}[]) {
  return records.filter(a => {
    if (!a.end) return false;
    const span = (+new Date(a.end) - +new Date(a.start)) / 60000, brk = Math.max(0, a.breakMinutes || 0);
    return brk < requiredBreak(span - brk);
  }).length;
}
