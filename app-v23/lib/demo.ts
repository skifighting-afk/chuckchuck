import {normalizeTeam,today,datePlus} from './team-model';
/** Entirely synthetic fixture; never reads a tenant or persists changes. */
export function demoTeam(){
 const s=normalizeTeam(null);delete s.legacy;
 s.store={name:'척척이네 식당',branch:'본점'};s.branches=[{id:'branch-main',name:'본점',address:''}];
 s.employees=s.employees.slice(0,4).map((e,i)=>({...e,name:['김예시','박샘플','이체험','정가상'][i],email:`demo${i}@example.invalid`,phone:'010-0000-0000',status:'재직' as const,leaveBalance:5,contract:{...e.contract,workplace:'척척이네 식당',employer:'예시 사장님'}}));
 s.shifts=s.employees.flatMap((e,i)=>Array.from({length:5},(_,j)=>({id:`demo-shift-${i}-${j}`,employeeId:e.id,date:datePlus(today(),j),start:i%2?'13:00':'09:00',end:i%2?'21:00':'17:00',breakMinutes:60})));
 s.attendance=s.employees.map((e,i)=>({id:`demo-attendance-${i}`,employeeId:e.id,start:today()+`T${i%2?'13':'09'}:00:00+09:00`,end:i===3?null:today()+`T${i%2?'21':'17'}:00:00+09:00`,breakMinutes:60,breakStart:null}));
 s.requests=[];s.payrollRuns={};s.adjustments={};s.settings={...s.settings,employerName:'예시 사장님',autoPayslip:false,autoContract:false};return s;
}
