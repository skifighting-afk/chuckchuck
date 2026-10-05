import {type Team,calculate,today,kdate,won} from '@/lib/team-model';
import {checkDay} from '@/lib/attendance-check';
import {todayBoard,budgetStatus} from '@/lib/close-check';
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
 const board=todayBoard(state,branch,today(),findings),budget=budgetStatus(state,branch,month),span=board.hi-board.lo,pos=(h:number)=>((h-board.lo)/span*100)+'%';
 const nowLabel=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short',hour:'numeric',minute:'2-digit'}).format(new Date());
 const title=board.working?`지금 ${board.working}명 일하는 중`:board.left?`오늘 ${board.left}명 더 출근해요`:board.rows.length?'오늘 근무가 모두 끝났어요':'오늘은 잡힌 근무가 없어요';
 const ticks=Array.from({length:5},(_,i)=>board.lo+Math.round(span*i/4));
 const shown=board.rows.slice(0,8);
 return <div className="home-overview">{checklist}
  <section className="today-hero" aria-labelledby="today-hero-title">
   <div className="today-hero-top"><span>{nowLabel}</span>{board.attention>0&&<button type="button" className="today-chip" onClick={onAttendance}>확인 필요 {board.attention}</button>}</div>
   <h2 id="today-hero-title">{title}</h2>
   {board.rows.length>0?<div className="today-board">
    <div className="today-ticks" aria-hidden="true">{ticks.map((h,i)=><span key={i} style={{left:pos(h)}}>{h%24}시</span>)}</div>
    <ul>{shown.map(r=><li key={r.id}><span className="today-name">{r.name}</span><span className="today-track" aria-hidden="true"><span className={'today-bar '+r.status} style={{left:pos(r.from),width:((r.to-r.from)/span*100)+'%'}}/>{board.now!==null&&<span className="today-now" style={{left:pos(board.now)}}/>}</span><span className={'today-state '+r.status}>{r.label}</span></li>)}</ul>
    {board.rows.length>shown.length&&<p className="today-more">외 {board.rows.length-shown.length}명은 근무표에서 볼 수 있어요</p>}
    <div className="today-legend" aria-hidden="true"><span className="working">근무 중</span><span className="late">늦음</span><span className="planned">예정</span><span className="done">퇴근</span></div>
   </div>:<p className="today-empty">근무표를 짜 두면 여기서 오늘 누가 언제 일하는지 한눈에 보여요.</p>}
   <div className="today-actions"><button type="button" onClick={onAttendance}>출퇴근 기록 →</button><button type="button" onClick={onSchedule}>{board.rows.length?'오늘 근무표 →':'근무표 짜기 →'}</button></div>
  </section>
  {children}
  <section className="home-stats" aria-label="이번 달 요약">
   <button type="button" className="home-stat wide" onClick={onPayroll}><span>{Number(month.slice(5))}월 {run?.locked?'확정':'예상'} 급여</span><b>{won(total)}<small>원</small></b><small>{run?.locked?'확정된 실수령 합계 · 송금 내역 아님':'입력된 근무·수당·공제 기준 · 검토 전'}</small><em>급여 자세히 보기 →</em></button>
   {budget&&<button type="button" className={'home-stat'+(budget.over?' warn':budget.near?' caution':'')} onClick={onPayroll}><span>인건비 예산</span><b>{Math.round(budget.ratio*100)}<small>%</small></b><small>근무표 기준 {won(budget.planned)}원 / {won(budget.budget)}원</small></button>}
   <button type="button" className="home-stat" onClick={onAttendance}><span>오늘 출근</span><b>{attended}<small>명</small></b><small>지금 근무 {working}명</small></button>
   <button type="button" className={'home-stat'+(findings.length?' caution':'')} onClick={onAttendance}><span>오늘 확인 권장</span><b>{findings.length}<small>건</small></b><small>{findings.length?[...new Set(findings.map(f=>f.kind))].join('·'):'지각·미출근 없음'}</small></button>
  </section>
  <button className="home-schedule-link" onClick={onJoin||(()=>location.assign('/staff-requests'))}>직원 가입 신청 확인 →</button>
 </div>;
}
