import {type Team,calculate,today,kdate,won} from '@/lib/team-model';
import {checkDay} from '@/lib/attendance-check';
import {useState} from 'react';
// 가이드 34: 첫 사용 5단계. 다 끝내거나 '숨기기'를 누르면 사라진다(이 기기에만 기억).
export function startSteps(state:Team,branch:string){
 const ids=new Set(state.employees.filter(e=>e.branchId===branch).map(e=>e.id));
 return [
  {key:'store',label:'가게 만들기',done:true},
  {key:'staff',label:'직원 1명 연결하기',done:ids.size>0},
  {key:'shift',label:'이번 주 근무표 짜기',done:state.shifts.some(x=>ids.has(x.employeeId))},
  {key:'clock',label:'첫 출퇴근 기록 받기',done:state.attendance.some(a=>ids.has(a.employeeId))},
  {key:'pay',label:'첫 급여 확정하기',done:Object.values(state.payrollRuns||{}).some((r:any)=>r?.locked&&r.branch===branch)},
 ];
}
function StartChecklist({state,branch,go}:{state:Team,branch:string,go:Record<string,(()=>void)|undefined>}){
 const KEY='chukchuk-start-hidden';const [hidden,setHidden]=useState(()=>{try{return localStorage.getItem(KEY)==='1'}catch{return false}});
 const steps=startSteps(state,branch),left=steps.filter(x=>!x.done);
 if(hidden||!left.length)return null;
 const next=left[0];
 return <section className="start-steps" aria-label="시작하기"><div className="start-steps-head"><b>시작하기 {steps.length-left.length}/{steps.length}</b><button type="button" className="saas-text-button" onClick={()=>{setHidden(true);try{localStorage.setItem(KEY,'1')}catch{}}}>숨기기</button></div>
  <ol>{steps.map(x=><li key={x.key} className={x.done?'done':x===next?'next':''}><span aria-hidden="true">{x.done?'✓':''}</span>{x.label}{x===next&&go[x.key]&&<button type="button" onClick={go[x.key]}>지금 하기 →</button>}</li>)}</ol></section>;
}
export function HomeOverview({state,branch,onPayroll,onAttendance,onSchedule,onEmployees,onRegister,onJoin,children}:{children?:import('react').ReactNode;state:Team;branch:string;onPayroll:()=>void;onAttendance:()=>void;onSchedule:()=>void;onEmployees:()=>void;onRegister:()=>void;onJoin?:()=>void}){
 const employees=state.employees.filter(e=>e.branchId===branch),ids=new Set(employees.map(e=>e.id)),month=today().slice(0,7),run=state.payrollRuns[month+':'+branch];
 const rows=run?.locked?run.rows:calculate(state,month).filter(e=>e.branchId===branch),total=rows.reduce((sum:number,row:any)=>sum+row.net,0);
 const here=state.attendance.filter(a=>ids.has(a.employeeId));
 const attended=new Set(here.filter(a=>kdate(a.start)===today()).map(a=>a.employeeId)).size;
 const working=new Set(here.filter(a=>!a.end).map(a=>a.employeeId)).size;
 const findings=checkDay(today(),state.shifts.filter(x=>ids.has(x.employeeId)),here,((state.settings as any).attendanceTolerance||'normal'));
 const go={staff:onJoin||(()=>location.assign('/staff-requests')),shift:onSchedule,clock:onAttendance,pay:onPayroll};
 const checklist=<StartChecklist state={state} branch={branch} go={go}/>;
 if(!employees.length)return <>{checklist}<section className="home-start"><img src="/cheokcheoki-welcome.png" alt="" width="88" height="88"/><h2>직원이 직접 신청하면, 사장님은 수락만</h2><p>직원에게 가입 주소를 알려 주세요. 합류 신청을 확인하고 수락하면 우리 가게에 연결돼요.</p><button className="home-main-action" onClick={onJoin||(()=>location.assign('/staff-requests'))}>직원 가입 안내·신청 확인 →</button><p><button onClick={onRegister}>사장님이 직접 직원 입력하기</button></p></section></>;
 return <div className="home-overview">{checklist}<button className="home-schedule-link" onClick={onJoin||(()=>location.assign('/staff-requests'))}>직원 가입 신청 확인 →</button><section className="home-pay-summary" aria-labelledby="home-pay-title"><div className="home-pay-label"><h2 id="home-pay-title">이번 달 {run?.locked?'확정':'예상'} 급여</h2><span>{Number(month.slice(5))}월</span></div><div className="home-pay-amount">{won(total)}<span>원</span></div><p>{run?.locked?'확정된 실수령 합계 · 송금 내역은 아니에요':'입력된 근무·수당·공제 기준 · 검토 전'}</p><div className="home-pay-bottom"><button className="home-main-action" onClick={onPayroll}>급여 자세히 보기 →</button><img src="/cheokcheoki-guide.png" alt="" width="72" height="72"/></div></section><section className="home-today"><button className="home-row-link" onClick={onAttendance}><span>오늘 출근 <strong>{attended}명</strong></span><span>지금 근무 {working}명 <b aria-hidden="true">→</b></span></button><button className="home-schedule-link" onClick={onSchedule}>오늘 근무표 보기 →</button>{findings.length>0&&<button className="home-row-link home-check" onClick={onAttendance}>오늘 확인 권장 <b>{findings.length}건</b> · {[...new Set(findings.map(f=>f.kind))].join('·')} →</button>}</section>{children}</div>;
}
