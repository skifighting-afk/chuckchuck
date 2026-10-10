// 결제 인원 = 결제일 현재 재직 직원 수(2026-10-10 대표님 위임).
// 퇴사·입사 준비(초대 대기 포함)는 세지 않는다. 같은 사람이 여러 직원 줄로 잡혀 있거나 사장·관리자 계정에 연결돼 있어도 한 명으로 센다.
// 한 명 미만이면 1명으로 본다(사장님 한 명분 최소 요금).
type Emp = {id: string; status?: string};
type Link = {userId?: string; employeeId?: string};
export function billableStaffCount(data: any): number {
  const emps: Emp[] = Array.isArray(data?.employees) ? data.employees : [];
  const links: Link[] = Array.isArray(data?._members) ? data._members : [];
  const people = new Set<string>();
  for (const e of emps) {
    if (!e || e.status !== '재직') continue;
    const uid = links.find(m => m && m.employeeId === e.id)?.userId;
    people.add(uid ? 'u:' + uid : 'e:' + e.id);
  }
  return Math.max(1, people.size);
}
