// 가이드 44: 서버 오류(5xx)가 10분 안에 3번 이상 나면 본사 계정 휴대폰으로 알림(1시간에 한 번까지).
// 개인정보는 남기지 않는다: 기능 이름(경로)과 오류 번호만.
export const ALERT_WINDOW_MS = 10 * 60000, ALERT_THRESHOLD = 3, ALERT_COOLDOWN_MS = 60 * 60000;
type DB = {prepare: (sql: string) => {bind: (...v: any[]) => {first: <T = any>() => Promise<T | null>; run: () => Promise<any>}}};
export async function recordServerError(db: DB, where: string, errorId: string | undefined, notify: (msg: {title: string; body: string; url: string}) => Promise<unknown>, now = Date.now()) {
  const row = await db.prepare(`INSERT INTO ops_alerts(key,window_start,hits,last_error) VALUES('5xx',?,1,?)
    ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN ops_alerts.window_start < ? THEN 1 ELSE ops_alerts.hits+1 END,
      window_start=CASE WHEN ops_alerts.window_start < ? THEN ? ELSE ops_alerts.window_start END, last_error=?
    RETURNING hits,last_sent`).bind(now, errorId || null, now - ALERT_WINDOW_MS, now - ALERT_WINDOW_MS, now, errorId || null).first<any>();
  if (!row || Number(row.hits) < ALERT_THRESHOLD) return false;
  if (row.last_sent && now - Number(row.last_sent) < ALERT_COOLDOWN_MS) return false;
  // 동시에 여러 요청이 와도 한 번만 보낸다
  const claimed = await db.prepare(`UPDATE ops_alerts SET last_sent=? WHERE key='5xx' AND (last_sent IS NULL OR last_sent < ?) RETURNING key`).bind(now, now - ALERT_COOLDOWN_MS).first<any>();
  if (!claimed) return false;
  await notify({title: '서버 오류가 잇달아 났어요', body: `최근 10분 동안 ${row.hits}건 · ${where} · 마지막 오류 번호 ${errorId || '-'}. 함수 로그에서 오류 번호를 찾아 주세요.`, url: '/admin'}).catch(() => 0);
  return true;
}
