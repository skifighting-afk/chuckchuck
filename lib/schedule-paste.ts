// 지시서 088: 사진·엑셀로 받은 근무표를 빨리 옮기기 — 표를 복사해 붙여 넣거나 한 줄씩 적으면 근무로 바꾼다.
// 형식 ① 표: 첫 줄에 요일(월~일)이나 날짜(10/12·12일), 다음 줄부터 '이름 | 칸들' ② 줄: "김민지 월 9-18, 수 10-15"
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n: number) => String(n).padStart(2, '0');
const plus = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
/** "9-18" "09:00~18:00" "9시-18시" "오전9-오후6" "18-2" → {start,end} */
export function parseRange(v: string): {start: string; end: string} | null {
  const t = v.replace(/\s/g, '').replace(/[~〜–—]/g, '-').replace(/시/g, ':').replace(/:(?=-|$)/g, '');
  const m = t.match(/^(오전|오후)?(\d{1,2})(?::(\d{2}))?-(오전|오후)?(\d{1,2})(?::(\d{2}))?$/); if (!m) return null;
  let a = +m[2], b = +m[5]; const am = +(m[3] || 0), bm = +(m[6] || 0);
  if (m[1] === '오후' && a < 12) a += 12; if (m[4] === '오후' && b < 12) b += 12; if (m[4] === '오전' && b === 12) b = 0;
  // '9-6'처럼 끝이 시작보다 작고 12시 이하면 오후로 본다(밤샘 '18-2'는 그대로 다음 날)
  if (!m[4] && b < a && b <= 12 && a < 12 && b + 12 > a) b += 12;
  if (a > 24 || b > 24 || am > 59 || bm > 59) return null; if (a === 24) a = 0; if (b === 24) b = 0;
  const start = `${pad(a)}:${pad(am)}`, end = `${pad(b)}:${pad(bm)}`; return start === end ? null : {start, end};
}
type Emp = {id: string; name: string};
export function parsePastedSchedule(text: string, emps: Emp[], weekStart: string) {
  const rows = text.replace(/\r/g, '').split('\n').map(l => l.split(/\t|\s*\|\s*|,(?=\S)/).map(c => c.trim())).filter(r => r.some(Boolean));
  const byName = new Map(emps.map(e => [e.name.replace(/\s/g, ''), e.id])), out: {employeeId: string; date: string; start: string; end: string}[] = [], problems: string[] = [];
  const week = Array.from({length: 7}, (_, i) => plus(weekStart, i));
  const dayOf = (h: string): string | null => {
    const s = h.replace(/\s|\(|\)|요일/g, '');
    const w = WD.findIndex(x => s === x || s.endsWith(x) && !/\d$/.test(s)); const d1 = s.match(/^(\d{1,2})[./월](\d{1,2})/), d2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/), d3 = s.match(/^(\d{1,2})일/);
    if (d2) return `${d2[1]}-${d2[2]}-${d2[3]}`; if (d1) { const md = `${pad(+d1[1])}-${pad(+d1[2])}`; return week.find(x => x.slice(5) === md) || `${weekStart.slice(0, 4)}-${md}`; }
    if (d3) return week.find(x => +x.slice(8) === +d3[1]) || null; if (w >= 0) return week.find(x => new Date(x + 'T00:00:00Z').getUTCDay() === w) || null; return null;
  };
  const name = (v: string) => byName.get(v.replace(/\s/g, ''));
  const head = rows[0] || [], cols = head.map(dayOf), isGrid = cols.filter(Boolean).length >= 2;
  if (isGrid) rows.slice(1).forEach((r, i) => { const id = name(r[0] || ''); if (!id) { if (r[0]) problems.push(`${i + 2}줄: '${r[0]}' 직원이 없어요.`); return; }
    r.forEach((c, k) => { if (!k || !cols[k] || !c || /^(휴|off|-|x)$/i.test(c)) return; const t = parseRange(c); if (t) out.push({employeeId: id, date: cols[k]!, ...t}); else problems.push(`${i + 2}줄 ${head[k]}: '${c}' 시간을 못 읽었어요.`); }); });
  else text.split('\n').map(l => l.trim()).filter(Boolean).forEach((l, i) => {
    const m = l.match(/^([^\s\d]+)\s+(.+)$/); const id = m && name(m[1]); if (!m || !id) { problems.push(`${i + 1}줄: 이름을 맨 앞에 적어 주세요.`); return; }
    for (const part of m[2].split(/[,/·]/).map(x => x.trim()).filter(Boolean)) { const p = part.match(/^(\S+)\s+(.+)$/); const d = p && dayOf(p[1]); const t = p && parseRange(p[2]); if (d && t) out.push({employeeId: id, date: d, ...t}); else problems.push(`${i + 1}줄: '${part}'을(를) 못 읽었어요. 예: 월 9-18`); }
  });
  return {shifts: out, problems};
}
