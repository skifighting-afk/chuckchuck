type Employee={id:string;name:string;status:string;contract:{status:string}};
type Contract={employeeId:string;id?:string;status?:string;changed?:boolean};
type Slip={employee_id:string;run_key:string;revision:number;state:string;activity?:{viewed_at?:string}};
type Status={label:string;tone:'green'|'amber'|'muted';action:boolean};
const status=(label:string,tone:Status['tone'],action=false):Status=>({label,tone,action});
export function documentOverview(employees:Employee[],contracts:Contract[]|null,docs:Slip[]|null,runKey:string,locked:boolean){
 return employees.filter(e=>e.status!=='퇴사').map(e=>{
  const c=contracts?.find(c=>c.employeeId===e.id);
  const contract=contracts===null?status('상태 확인 필요','muted'):c?.changed?status(c.status==='waiting'?'조건 변경 · 재요청 필요':'조건 변경 확인','amber',true):c?.status==='waiting'?status('직원 서명 대기','amber',true):c?.status==='signed'?status('양측 서명 완료','green'):c?.status==='declined'?status('수정 요청 확인','amber',true):c?.status==='withdrawn'?status('요청 철회 · 다시 확인','amber',true):e.contract.status==='체결 완료'?status('서면 체결 기록','green'):status('계약 작성 필요','amber',true);
  const d=docs?.filter(d=>d.employee_id===e.id&&d.run_key===runKey).sort((a,b)=>b.revision-a.revision)[0];
  const payslip=docs===null?status('상태 확인 필요','muted'):d?.state==='current'?d.activity?.viewed_at?status('직원 확인함','green'):status('전달 완료 · 확인 대기','muted'):!locked?status('급여 확정 후 전달','muted'):d?status('수정본 전달 필요','amber',true):status('명세서 전달 필요','amber',true);
  return {employee:e,contract,contractId:c?.id,payslip,needsAction:contract.action||payslip.action};
 });
}
