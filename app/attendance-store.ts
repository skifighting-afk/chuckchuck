// 작업 045: 출퇴근 기록은 attendance_records 테이블에 있다.
// 서버는 최근 기간(ATTENDANCE_WINDOW_DAYS)과 아직 확정하지 않은 급여 달의 기록만 가게 데이터에 붙여 쓴다.
// 붙일 때 _attendanceFrom(그 시각 이후만 붙였다는 표시)을 같이 넣어 두면, 저장할 때 DB 트리거가 그 범위만 맞춘다.
export const ATTENDANCE_WINDOW_DAYS = 400;
const DAY = 86400000;
const parse = (v: any) => (typeof v === 'string' ? JSON.parse(v) : v);

/** 이 시각 이후 기록을 붙인다: 400일 전, 또는 확정 해제 중인 급여 달의 7일 전(주휴 계산용) 중 더 이른 쪽 */
export function attendanceSince(data: any, now = Date.now()) {
  let since = now - ATTENDANCE_WINDOW_DAYS * DAY;
  for (const run of Object.values<any>(data?.payrollRuns || {})) {
    if (run && !run.locked && /^\d{4}-\d{2}$/.test(run.month || '')) since = Math.min(since, Date.parse(run.month + '-01T00:00:00+09:00') - 7 * DAY);
  }
  return new Date(since).toISOString();
}

export async function loadAttendance(db: D1Database, owner: string, from?: string, to?: string) {
  const rows = (await db.prepare('SELECT record FROM attendance_records WHERE owner=? AND start_at>=? AND start_at<? ORDER BY start_at, id').bind(owner, from || '', to || '￿').all<any>()).results;
  return rows.map(r => parse(r.record));
}

/** 가게 데이터(객체)에 출퇴근 기록을 붙인다. */
export async function hydrateAttendance(db: D1Database, owner: string, data: any, since = attendanceSince(data)) {
  if (!data || typeof data !== 'object') return data;
  data.attendance = await loadAttendance(db, owner, since);
  data._attendanceFrom = since;
  return data;
}

/** 붙인 범위보다 앞선 달의 급여를 계산할 때: 그 기간 기록을 더 붙인다(중복 제외). 트리거는 _attendanceFrom 이전 기록을 지우지 않는다. */
export async function extendAttendance(db: D1Database, owner: string, state: {attendance: any[]}, from: string, hydratedFrom?: string) {
  if (!hydratedFrom || from >= hydratedFrom) return;
  const extra = await loadAttendance(db, owner, from, hydratedFrom);
  const ids = new Set(state.attendance.map(a => a.id));
  state.attendance = [...extra.filter(a => !ids.has(a.id)), ...state.attendance];
}
