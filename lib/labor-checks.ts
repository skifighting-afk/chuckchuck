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

type ContractMember = {
  wage: number; payType: string; payDay: number; employment: string; endDate?: string; weeklyHours?: number; phone?: string; email?: string;
  contract: {workplace?: string; duties?: string; workDays?: string; start?: string; end?: string; holiday?: string; leave?: string; paymentMethod?: string; employer?: string};
};
const blank = (v: unknown) => typeof v !== 'string' || !v.trim();

/**
 * 근로계약서 필수 기재사항 중 비어 있는 항목.
 * 근로기준법 제17조·시행령 제8조: 임금(구성항목·계산방법·지급방법), 소정근로시간, 주휴일, 연차유급휴가, 취업 장소와 업무.
 * 기간제 및 단시간근로자 보호 등에 관한 법률 제17조: 근로계약기간, 휴게, (단시간) 근로일 및 근로일별 근로시간.
 */
export function contractMissing(e: ContractMember) {
  const c = e.contract || {}, out: string[] = [];
  if (!(e.wage > 0)) out.push('임금');
  if (!e.payDay) out.push('임금 지급일');
  if (blank(c.paymentMethod)) out.push('임금 지급방법');
  if (blank(c.start) || blank(c.end)) out.push('소정근로시간(시업·종업 시각)');
  if (blank(c.workDays)) out.push('근로일');
  if (blank(c.holiday)) out.push('휴일(주휴일)');
  if (blank(c.leave)) out.push('연차유급휴가');
  if (blank(c.workplace)) out.push('취업 장소');
  if (blank(c.duties)) out.push('종사 업무');
  if (e.employment === '기간제' && blank(e.endDate)) out.push('근로계약기간(종료일)');
  if (e.employment === '단시간' && !(Number(e.weeklyHours) > 0)) out.push('주 소정근로시간');
  if (blank(c.employer)) out.push('사업주');
  if (blank(e.phone)) out.push('직원 연락처');
  if (blank(e.email)) out.push('직원 이메일');
  return out;
}
