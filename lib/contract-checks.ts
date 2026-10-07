// 지시서 9주차: 근로계약 점검 — 계약서 없이 일하는 직원, 기간제 2년(무기계약 전환), 계약 끝났는데 계속 일함, 서명 요청 오래됨
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
type Emp = {id: string; name: string; status: string; employment: string; joined: string; endDate?: string; contract: {status: string}};
export type ContractAlert = {employeeId: string; name: string; level: '위험' | '확인'; text: string; fix: string};
const plus = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const addYears = (d: string, y: number) => `${Number(d.slice(0, 4)) + y}${d.slice(4)}`;
const md = (d: string) => `${d.slice(0, 4)}년 ${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;

/** lastWorked: 직원별 마지막 출근일(YYYY-MM-DD) */
export function contractAlerts(emps: Emp[], lastWorked: Record<string, string>, today: string): ContractAlert[] {
  const out: ContractAlert[] = [];
  for (const e of emps.filter(e => e.status !== '퇴사')) {
    const add = (level: ContractAlert['level'], text: string, fix: string) => out.push({employeeId: e.id, name: e.name, level, text, fix});
    const worked = lastWorked[e.id];
    // 계약서 없이 일함: 첫 근무 뒤 체결 기록이 없으면(근로기준법 제17조, 500만 원 이하 벌금)
    if (e.contract.status !== '체결 완료' && worked && e.employment !== '독립 용역') add('위험', `근로계약서 체결 기록 없이 일하고 있어요(상태: ${e.contract.status}).`, '근로계약서를 써서 직원에게 한 부 주고, 체결을 기록해 주세요.');
    if (e.employment === '기간제' && /^\d{4}-\d{2}-\d{2}$/.test(e.joined)) {
      const two = addYears(e.joined, 2);
      if (today >= two) add('위험', `기간제로 2년(${md(two)})을 넘겼어요. 기간제법상 기간의 정함이 없는 근로자로 볼 수 있어요.`, '근로 형태를 \'기간의 정함 없음\'으로 바꾸고 계약서를 다시 써 주세요.');
      else if (today >= plus(two, -60)) add('확인', `기간제 2년이 ${md(two)}에 차요.`, '계속 함께 일할지 정하고, 계속 일하면 무기계약으로 바꿀 준비를 해 주세요.');
      if (e.endDate && /^\d{4}-\d{2}-\d{2}$/.test(e.endDate) && e.endDate < today && worked && worked > e.endDate) add('위험', `계약 기간(${md(e.endDate)}까지)이 끝났는데 ${md(worked)}에도 일했어요.`, '재계약서를 쓰거나 계약 종료일을 고쳐 주세요. 그대로 두면 계약이 이어진 것으로 볼 수 있어요.');
    }
    if (!e.endDate && e.employment === '기간제') add('확인', '기간제인데 계약 종료일이 비어 있어요.', '직원 관리에서 계약 종료일을 넣어 주세요.');
  }
  return out.sort((a, b) => a.level === b.level ? 0 : a.level === '위험' ? -1 : 1);
}
