// 지시서 2주차 024: 근무표가 바뀐 직원에게만 알림. 오늘 이후 근무만 비교한다.
type Shift = {id: string; employeeId: string; date: string; start: string; end: string};
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;
const key = (s: Shift) => `${s.date} ${s.start}–${s.end}`;
/** 직원별 바뀐 내용 한 줄(추가·삭제·변경). 바뀐 직원만 담는다. */
export function scheduleChanges(before: Shift[], after: Shift[], from: string): Map<string, string> {
  const out = new Map<string, string>();
  const up = (l: Shift[]) => l.filter(s => s.date >= from);
  const b = new Map(up(before).map(s => [s.id, s])), a = new Map(up(after).map(s => [s.id, s]));
  const by = new Map<string, string[]>(), add = (id: string, t: string) => by.set(id, [...(by.get(id) || []), t]);
  for (const [id, s] of a) { const o = b.get(id); if (!o) add(s.employeeId, `${md(s.date)} ${s.start}–${s.end} 추가`); else if (key(o) !== key(s) || o.employeeId !== s.employeeId) { if (o.employeeId !== s.employeeId) { add(o.employeeId, `${md(o.date)} ${o.start}–${o.end} 빠짐`); add(s.employeeId, `${md(s.date)} ${s.start}–${s.end} 추가`); } else add(s.employeeId, `${md(o.date)} ${o.start}–${o.end} → ${o.date === s.date ? '' : md(s.date) + ' '}${s.start}–${s.end}`); } }
  for (const [id, o] of b) if (!a.has(id)) add(o.employeeId, `${md(o.date)} ${o.start}–${o.end} 빠짐`);
  for (const [emp, list] of by) out.set(emp, list.slice(0, 3).join(', ') + (list.length > 3 ? ` 외 ${list.length - 3}건` : ''));
  return out;
}
