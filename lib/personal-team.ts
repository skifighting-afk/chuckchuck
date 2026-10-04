import type {Team} from './team-model';

// Personal screens never receive colleagues' records. Delegated branch work
// has its own permission-checked /api/manager endpoint.
export function personalTeam(state:Team,selfId:string):Team{
 const self=state.employees.find(e=>e.id===selfId);
 if(!self)throw new Error('본인 직원 정보를 찾을 수 없습니다.');
 return {
  schemaVersion:2,
  store:{...state.store,branch:state.branches.find(b=>b.id===self.branchId)?.name||''},
  branches:state.branches.filter(b=>b.id===self.branchId),
  employees:[{...self,notes:''}],
  shifts:state.shifts.filter(s=>s.employeeId===selfId),
  attendance:state.attendance.filter(a=>a.employeeId===selfId),
  adjustments:Object.fromEntries(Object.entries(state.adjustments).filter(([key])=>key.endsWith(':'+selfId))),
  payrollRuns:Object.fromEntries(Object.entries(state.payrollRuns)
   .filter(([,run])=>run.locked&&run.rows.some((row:any)=>row.employeeId===selfId))
   .map(([key,run])=>[key,{
    locked:run.locked,month:run.month,branch:run.branch,payDate:run.payDate,
    at:run.at,revision:run.revision,rows:run.rows.filter((row:any)=>row.employeeId===selfId)
   }])),
  requests:state.requests.filter(r=>r.before?.employeeId===selfId&&r.after?.employeeId===selfId)
   .map(r=>({...r,reviewer:r.reviewer?{name:r.reviewer.name}:undefined})),
  settings:{accountantName:'',accountantEmail:'',autoPayslip:false,autoContract:false,autoAccountant:false,employerName:''}
 };
}
