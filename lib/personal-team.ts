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
  // 개선 2차: 사장님 전용 메모·평가·태그·퇴사 사유는 빼고, 직원이 고른 알림 시간만
  employees:[{...self,notes:'',...((self as any).extra?{extra:{...((self as any).extra.beforeMin!=null?{beforeMin:(self as any).extra.beforeMin}:{}),...((self as any).extra.praise?{praise:(self as any).extra.praise}:{})}}:{})} as any],
  shifts:state.shifts.filter(s=>s.employeeId===selfId),
  attendance:state.attendance.filter(a=>a.employeeId===selfId).map(({memo,...a}:any)=>a),
  adjustments:Object.fromEntries(Object.entries(state.adjustments).filter(([key])=>key.endsWith(':'+selfId))),
  payrollRuns:Object.fromEntries(Object.entries(state.payrollRuns)
   .filter(([,run])=>run.locked&&run.rows.some((row:any)=>row.employeeId===selfId))
   .map(([key,run])=>[key,{
    locked:run.locked,month:run.month,branch:run.branch,payDate:run.payDate,
    at:run.at,revision:run.revision,...(run.paid?.[selfId]?{paid:{[selfId]:run.paid[selfId]}}:{}),rows:run.rows.filter((row:any)=>row.employeeId===selfId)
   }])),
  requests:state.requests.filter(r=>r.before?.employeeId===selfId&&r.after?.employeeId===selfId)
   .map(r=>({...r,reviewer:r.reviewer?{name:r.reviewer.name}:undefined})),
  ...((state as any).staffAsks?{staffAsks:(state as any).staffAsks.filter((x:any)=>x.employeeId===selfId)}:{}),
  ...((state as any).certificates?{certificates:(state as any).certificates.filter((c:any)=>c.employeeId===selfId)}:{}),
  // 지시서 3주차 023: 내 매장 공개 근무표와 내 확인 기록만
  ...((state as any).publishedWeeks?{publishedWeeks:Object.fromEntries(Object.entries((state as any).publishedWeeks).filter(([k])=>k.startsWith(self.branchId+':')).map(([k,v]:any)=>[k,{at:v.at,acks:v.acks?.[selfId]?{[selfId]:v.acks[selfId]}:{}}]))}:{}),
  ...((state as any).advances?{advances:(state as any).advances.filter((x:any)=>x.employeeId===selfId).map(({by,at,...x}:any)=>x)}:{}),
  ...((state as any).events?{events:(state as any).events.filter((x:any)=>!x.branchId||x.branchId===self.branchId)}:{}),
  ...((state as any).dayOffWishes?{dayOffWishes:(state as any).dayOffWishes.filter((x:any)=>x.employeeId===selfId)}:{}),
  // 지시서 028: 내 매장에서 모집 중인 빈 근무(누가 맡았는지는 빼고)
  ...((state as any).openShifts?{openShifts:(state as any).openShifts.filter((o:any)=>o.branchId===self.branchId&&(o.status==='모집 중'||o.assignedTo===selfId)).map(({assignedTo,...o}:any)=>assignedTo===selfId?{...o,assignedTo}:o)}:{}),
  settings:{accountantName:'',accountantEmail:'',autoPayslip:false,autoContract:false,autoAccountant:false,employerName:'',fivePlus:!!state.settings.fivePlus,...((state.settings as any).weekStart?{weekStart:(state.settings as any).weekStart}:{}),...((state.settings as any).attendanceRule?{attendanceRule:(state.settings as any).attendanceRule}:{}),...((state.settings as any).staffPayEstimate===false?{staffPayEstimate:false}:{}),...(typeof (state.settings as any).availabilityDue==='number'?{availabilityDue:(state.settings as any).availabilityDue}:{}),...((state.settings as any).more?{more:{...((state.settings as any).more.todayNote?{todayNote:(state.settings as any).more.todayNote}:{}),...(typeof (state.settings as any).more.scheduleDue==='number'?{scheduleDue:(state.settings as any).more.scheduleDue}:{})}}:{})} as any
 };
}
