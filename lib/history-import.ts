// 지시서 087: 다른 서비스에서 쓰던 기록 가져오기 — 출퇴근·근무표·지난 급여를 엑셀/CSV로.
// 첫 줄 제목으로 종류를 알아낸다: 출근·퇴근 → 출퇴근, 시작·끝 → 근무표, 급여월·지급 → 지난 급여. 이름은 등록된 직원과 맞춘다.
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
export type Kind = '출퇴근' | '근무표' | '지난 급여';
const pad = (n: number) => String(n).padStart(2, '0');
const serial = (n: number) => new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().slice(0, 10);
export function toDate(v: string): string | null {
  const t = (v || '').trim(); if (/^\d{5}(\.\d+)?$/.test(t)) return serial(Number(t));
  const m = t.match(/^(\d{4})[-./년\s]*(\d{1,2})[-./월\s]*(\d{1,2})/); if (!m) return null;
  const d = `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`; return Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d ? d : null;
}
export function toTime(v: string): string | null {
  const t = (v || '').trim(); if (/^0?\.\d+$/.test(t)) { const m = Math.round(Number(t) * 1440); return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`; }
  const m = t.match(/(?:^|\s|T)(오전|오후)?\s*(\d{1,2})[:시]\s*(\d{2})?/); if (!m) return null;
  let h = +m[2]; if (m[1] === '오후' && h < 12) h += 12; if (m[1] === '오전' && h === 12) h = 0;
  return h < 24 && +(m[3] || 0) < 60 ? `${pad(h)}:${pad(+(m[3] || 0))}` : null;
}
const money = (v: string) => { const n = Number(String(v || '').replace(/[,원\s]/g, '')); return Number.isFinite(n) && /\d/.test(v || '') ? Math.round(n) : null; };
const find = (head: string[], re: RegExp) => head.findIndex(h => re.test(h.replace(/\s/g, '')));
export function parseHistory(rows: string[][], employees: {id: string; name: string}[]) {
  const head = (rows[0] || []).map(h => String(h || '')), body = rows.slice(1);
  const ci = {name: find(head, /이름|성명|직원/), date: find(head, /날짜|일자|근무일|date/i), in: find(head, /출근/), out: find(head, /퇴근/), brk: find(head, /휴게/), start: find(head, /^시작|근무시작|시작시간/), end: find(head, /^끝|종료|마침|근무종료/), month: find(head, /급여월|귀속월|지급월|^월$/), gross: find(head, /총지급|지급합계|지급액|세전/), ded: find(head, /공제/), net: find(head, /실수령|차인지급|실지급/)};
  const kind: Kind | null = ci.in >= 0 && ci.out >= 0 ? '출퇴근' : ci.start >= 0 && ci.end >= 0 ? '근무표' : ci.month >= 0 && (ci.gross >= 0 || ci.net >= 0) ? '지난 급여' : null;
  const byName = new Map(employees.map(e => [e.name.replace(/\s/g, ''), e.id]));
  const items: any[] = [], problems: string[] = [];
  if (!kind || ci.name < 0) return {kind, items, problems: ['첫 줄에 이름과 출근·퇴근(또는 시작·끝, 급여월·총지급) 제목이 있어야 해요.']};
  body.forEach((r, i) => {
    const line = i + 2, nm = String(r[ci.name] || '').replace(/\s/g, ''); if (!nm) return;
    const employeeId = byName.get(nm); if (!employeeId) { problems.push(`${line}줄: '${r[ci.name]}' 직원이 없어요. 직원을 먼저 등록하거나 이름을 맞춰 주세요.`); return; }
    if (kind === '지난 급여') { const mm = String(r[ci.month] || '').match(/(\d{4})[-./년\s]*(\d{1,2})/), month = mm ? `${mm[1]}-${pad(+mm[2])}` : null, gross = ci.gross >= 0 ? money(r[ci.gross]) : null, net = ci.net >= 0 ? money(r[ci.net]) : null, ded = ci.ded >= 0 ? money(r[ci.ded]) : null;
      if (!month || (gross === null && net === null)) { problems.push(`${line}줄: 급여월과 금액을 확인해 주세요.`); return; }
      items.push({employeeId, month, gross: gross ?? (net! + (ded || 0)), deduction: ded ?? (gross !== null && net !== null ? gross - net : 0), net: net ?? (gross! - (ded || 0))}); return; }
    const date = toDate(String(r[ci.date] ?? r[kind === '출퇴근' ? ci.in : ci.start] ?? ''));
    const a = toTime(String(r[kind === '출퇴근' ? ci.in : ci.start] || '')), b = toTime(String(r[kind === '출퇴근' ? ci.out : ci.end] || '')), brk = ci.brk >= 0 ? Math.max(0, Math.round(Number(String(r[ci.brk] || '0').replace(/[^\d.]/g, '')) || 0)) : 0;
    if (!date || !a || !b || a === b) { problems.push(`${line}줄: 날짜와 시각을 확인해 주세요.`); return; }
    items.push({employeeId, date, start: a, end: b, breakMinutes: brk});
  });
  return {kind, items, problems};
}
/** 한국 시각(날짜·시:분) → ISO, 끝이 시작보다 이르면 다음 날 */
export function toRecord(x: {employeeId: string; date: string; start: string; end: string; breakMinutes: number}) {
  const s = Date.parse(`${x.date}T${x.start}:00+09:00`); let e = Date.parse(`${x.date}T${x.end}:00+09:00`); if (e <= s) e += 86400000;
  return {employeeId: x.employeeId, start: new Date(s).toISOString(), end: new Date(e).toISOString(), breakMinutes: x.breakMinutes};
}
