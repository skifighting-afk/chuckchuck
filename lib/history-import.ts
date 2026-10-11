// 지시서 087: 다른 서비스에서 쓰던 기록 가져오기 — 출퇴근·근무표·지난 급여를 엑셀/CSV로.
// 첫 줄 제목으로 종류를 알아낸다. 직원 ID를 우선하고, 이름은 유일한 후보일 때만 연결한다.
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
export type HistoryEmployee = {id:string;name:string;branchId?:string;branchName?:string};
export type HistoryMapping = Record<number,string|null>;
export type UnmatchedHistoryRow = {line:number;name:string;fileEmployeeId:string;branch:string;reason:string;candidates:string[];cells:{title:string;value:string}[]};
const normalizeName = (value:string) => value.normalize('NFC').replace(/\s/g,'');
export function parseHistory(rows: string[][]&{sourceLines?:number[]}, employees: HistoryEmployee[], mapping:HistoryMapping={}) {
  const head = (rows[0] || []).map(h => String(h || '')), body = rows.slice(1);
  const ci = {name: find(head, /^(이름|성명|직원|직원명|직원이름|직원성명|근로자이름|근로자성명|name)$/i), employeeId:find(head,/^(직원ID|직원번호|사번|employeeid)$/i), branch:find(head,/^(매장|매장명|지점|지점명|매장ID|지점ID|branch|branchid)$/i), date: find(head, /날짜|일자|근무일|date/i), in: find(head, /출근/), out: find(head, /퇴근/), brk: find(head, /휴게/), start: find(head, /^시작|근무시작|시작시간/), end: find(head, /^끝|종료|마침|근무종료/), month: find(head, /급여월|귀속월|지급월|^월$/), gross: find(head, /총지급|지급합계|지급액|세전/), ded: find(head, /공제/), net: find(head, /실수령|차인지급|실지급/)};
  const kind: Kind | null = ci.in >= 0 && ci.out >= 0 ? '출퇴근' : ci.start >= 0 && ci.end >= 0 ? '근무표' : ci.month >= 0 && (ci.gross >= 0 || ci.net >= 0) ? '지난 급여' : null;
  const items: any[] = [], problems: string[] = [], unmatched:UnmatchedHistoryRow[]=[], excluded:number[]=[];
  if (!kind || ci.name < 0&&ci.employeeId<0) return {kind, items, unmatched, excluded, problems: ['첫 줄에 이름 또는 직원 ID와 출근·퇴근(또는 시작·끝, 급여월·총지급) 제목이 있어야 해요.']};
  body.forEach((r, i) => {
    const line=rows.sourceLines?.[i+1]??i+2,name=String(r[ci.name]||'').trim(),nm=normalizeName(name),fileEmployeeId=String(r[ci.employeeId]||'').trim(),branch=String(r[ci.branch]||'').trim();
    if(!r.some(value=>String(value??'').trim()))return;
    const chosen=Object.hasOwn(mapping,line);
    if(chosen&&mapping[line]===null){excluded.push(line);return;}
    const branchMatches=(e:HistoryEmployee)=>!branch||e.branchId===branch||normalizeName(e.branchName||'')===normalizeName(branch);
    const candidates=chosen?employees.filter(e=>e.id===mapping[line]):fileEmployeeId?employees.filter(e=>e.id===fileEmployeeId&&branchMatches(e)):employees.filter(e=>normalizeName(e.name)===nm&&branchMatches(e));
    if(candidates.length!==1){
      const reason=candidates.length>1?'같은 이름이나 ID의 직원이 여러 명이에요. 직접 연결해 주세요.':chosen?'선택한 직원 정보가 바뀌었어요. 다시 골라 주세요.':fileEmployeeId?'직원 ID 또는 매장이 일치하지 않아요. 직접 확인해 주세요.':'이름과 매장에 맞는 직원이 없어요. 직접 연결하거나 이 줄을 제외해 주세요.';
      unmatched.push({line,name,fileEmployeeId,branch,reason,candidates:candidates.map(e=>e.id),cells:Array.from({length:Math.max(head.length,r.length)},(_,index)=>({title:head[index]||`${index+1}번째 열`,value:String(r[index]??'')}))});
      problems.push(`${line}줄: ${reason}`);return;
    }
    const employeeId=candidates[0].id;
    if (kind === '지난 급여') { const mm = String(r[ci.month] || '').match(/(\d{4})[-./년\s]*(\d{1,2})/), month = mm ? `${mm[1]}-${pad(+mm[2])}` : null, gross = ci.gross >= 0 ? money(r[ci.gross]) : null, net = ci.net >= 0 ? money(r[ci.net]) : null, ded = ci.ded >= 0 ? money(r[ci.ded]) : null;
      if (!month || (gross === null && net === null)) { problems.push(`${line}줄: 급여월과 금액을 확인해 주세요.`); return; }
      items.push({employeeId, month, gross: gross ?? (net! + (ded || 0)), deduction: ded ?? (gross !== null && net !== null ? gross - net : 0), net: net ?? (gross! - (ded || 0))}); return; }
    const date = toDate(String(r[ci.date] ?? r[kind === '출퇴근' ? ci.in : ci.start] ?? ''));
    const a = toTime(String(r[kind === '출퇴근' ? ci.in : ci.start] || '')), b = toTime(String(r[kind === '출퇴근' ? ci.out : ci.end] || '')), brk = ci.brk >= 0 ? Math.max(0, Math.round(Number(String(r[ci.brk] || '0').replace(/[^\d.]/g, '')) || 0)) : 0;
    if (!date || !a || !b || a === b) { problems.push(`${line}줄: 날짜와 시각을 확인해 주세요.`); return; }
    items.push({employeeId, date, start: a, end: b, breakMinutes: brk});
  });
  return {kind, items, problems, unmatched, excluded};
}
/** 한국 시각(날짜·시:분) → ISO, 끝이 시작보다 이르면 다음 날 */
export function toRecord(x: {employeeId: string; date: string; start: string; end: string; breakMinutes: number}) {
  const s = Date.parse(`${x.date}T${x.start}:00+09:00`); let e = Date.parse(`${x.date}T${x.end}:00+09:00`); if (e <= s) e += 86400000;
  return {employeeId: x.employeeId, start: new Date(s).toISOString(), end: new Date(e).toISOString(), breakMinutes: x.breakMinutes};
}
