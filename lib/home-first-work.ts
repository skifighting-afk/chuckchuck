type State={employees:{id:string;branchId:string;status:string}[];shifts:{employeeId:string;branchId?:string}[];attendance:{employeeId:string;start:string}[]};
export function homeFirstWork(state:State,branch:string){
 const ids=new Set(state.employees.filter(e=>e.branchId===branch&&e.status!=='퇴사').map(e=>e.id));
 const steps=[
  {id:'employees',label:'직원 등록',done:ids.size>0,reason:'함께 일할 직원을 등록하면 근무표와 급여를 연결할 수 있어요.',action:'첫 직원 등록하기'},
  {id:'schedule',label:'근무표 만들기',done:state.shifts.some(s=>ids.has(s.employeeId)&&(!s.branchId||s.branchId===branch)),reason:'직원이 언제 일하는지 정해 두면 예정 시간과 출퇴근 기록을 비교할 수 있어요.',action:'첫 근무표 만들기'},
  {id:'attendance',label:'출퇴근 확인',done:state.attendance.some(a=>ids.has(a.employeeId)&&Number.isFinite(Date.parse(a.start))),reason:'직원이 출근하면 예정 시간과 실제 기록을 비교할 수 있어요.',action:'출퇴근 화면 확인하기'}
 ];
 return {steps,next:steps.find(s=>!s.done)||null};
}
