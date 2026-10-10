import {todayLabor} from '../lib/briefing';
import {type Team,calculate,today,kdate,won} from '@/lib/team-model';
import {checkDay} from '@/lib/attendance-check';
import {todayBoard,budgetStatus,homeAlerts} from '@/lib/close-check';
import {JoinInbox} from './join-inbox';
import {useState} from 'react';
import {startTour} from './tour';
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
 return <section className="start-steps" aria-label="시작하기"><div className="start-steps-head"><b>5분 시작하기 {steps.length-left.length}/{steps.length}</b><small className="start-left">남은 일 {left.length}개 · 약 {left.length*1+1}분</small><button type="button" className="saas-text-button" onClick={()=>startTour('owner')}>🧭 가이드 보기</button><button type="button" className="saas-text-button" onClick={()=>{setHidden(true);try{localStorage.setItem(KEY,'1')}catch{}}}>숨기기</button></div>
  <ol>{steps.map(x=><li key={x.key} className={x.done?'done':x===next?'next':''}><span aria-hidden="true">{x.done?'✓':''}</span>{x.label}{x===next&&go[x.key]&&<button type="button" onClick={go[x.key]}>지금 하기 →</button>}</li>)}</ol></section>;
}
export function HomeOverview({state,branch,onPayroll,onAttendance,onSchedule,onEmployees,onRegister,onJoin,children,assistant,demo=false,onChanged}:{assistant?:import('react').ReactNode;demo?:boolean;onChanged?:()=>void;children?:import('react').ReactNode;state:Team;branch:string;onPayroll:()=>void;onAttendance:()=>void;onSchedule:()=>void;onEmployees:()=>void;onRegister:()=>void;onJoin?:()=>void}){
 const employees=state.employees.filter(e=>e.branchId===branch),ids=new Set(employees.map(e=>e.id)),month=today().slice(0,7),run=state.payrollRuns[month+':'+branch];
 const rows=run?.locked?run.rows:calculate(state,month).filter(e=>e.branchId===branch),total=rows.reduce((sum:number,row:any)=>sum+row.net,0);
 const here=state.attendance.filter(a=>ids.has(a.employeeId));
 const findings=checkDay(today(),state.shifts.filter(x=>ids.has(x.employeeId)),here,((state.settings as any).attendanceTolerance||'normal'),Date.now(),((state as any).approvedLeaves||[]));
 const go={staff:onJoin||(()=>location.assign('/staff-requests')),shift:onSchedule,clock:onAttendance,pay:onPayroll};
 const checklist=<StartChecklist state={state} branch={branch} go={go}/>;
 if(!employees.length)return <>{!demo&&<JoinInbox onChanged={onChanged||(()=>location.reload())}/>}{checklist}<section className="home-start"><img src="/cheokcheoki-welcome.png" alt="" width="88" height="88"/><h2>직원이 직접 신청하면, 사장님은 수락만</h2><p>직원에게 가입 주소를 알려 주세요. 합류 신청을 확인하고 수락하면 우리 가게에 연결돼요.</p><button className="home-main-action" onClick={onJoin||(()=>location.assign('/staff-requests'))}>직원 가입 안내·신청 확인 →</button><p><button onClick={onRegister}>사장님이 직접 직원 입력하기</button></p></section></>;
 const tolName=((state.settings as any).attendanceTolerance||'normal'),board=todayBoard(state,branch,today(),findings,Date.now(),tolName==='lenient'?10:tolName==='strict'?0:5),alerts=homeAlerts(state,branch,today(),board),budget=budgetStatus(state,branch,month),span=board.hi-board.lo,pos=(h:number)=>((h-board.lo)/span*100)+'%';
 const nowLabel=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'long'}).format(new Date())+' '+new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'numeric',minute:'2-digit'}).format(new Date());
 const count=(st:string[])=>new Set(board.rows.filter(r=>st.includes(r.status)).map(r=>r.employeeId)).size;
 const groups=[{key:'working',label:'일하는 중',n:count(['working','late','extra'])},{key:'late',label:'그중 늦게 출근',n:count(['late'])},{key:'noshow',label:'출근 기록 없음',n:count(['noshow','missed'])},{key:'planned',label:'출근 전',n:count(['planned'])},{key:'done',label:'퇴근',n:count(['done'])}].filter(g=>g.n>0);
 const ticks=Array.from({length:5},(_,i)=>board.lo+Math.round(span*i/4));
 const shown=board.rows.slice(0,10);
 return <div className="home-overview">{!demo&&<JoinInbox onChanged={onChanged||(()=>location.reload())}/>}{checklist}
  {alerts.length>0&&<section className="home-alerts" aria-labelledby="home-alerts-title"><h2 id="home-alerts-title">알림 <b>{alerts.length}</b></h2><ul>{alerts.slice(0,5).map(a=><li key={a.key} className={a.tone}><div><b>{a.title}</b><span>{a.detail}</span></div><button type="button" onClick={onAttendance}>확인</button></li>)}</ul>{alerts.length>5&&<button type="button" className="home-alerts-more" onClick={onAttendance}>알림 {alerts.length-5}건 더 보기</button>}</section>}
  {(()=>{const t=todayLabor(employees as any,here as any,today(),Date.now());return <p className="home-today-cost" aria-label="오늘 인건비"><span>오늘 인건비 지금까지</span><b>약 {won(t.cost)}원</b><small>{t.hours}시간 · 시급×일한 시간, 월급은 하루치</small></p>})()}<button type="button" className="home-pay" onClick={onPayroll}><span className="home-pay-k">{Number(month.slice(5))}월 {run?.locked?'확정':'예상'} 급여</span><span className="home-pay-v">{won(total)}<small>원</small></span><span className="home-pay-note">{run?.locked?'확정된 실수령 합계예요. 송금 내역은 아니에요.':'지금까지 입력된 근무·수당·공제로 계산했어요. 확정 전이에요.'}</span>{budget&&<span className={'home-pay-budget'+(budget.over?' over':budget.near?' near':'')}><i style={{width:Math.min(100,Math.round(budget.ratio*100))+'%'}}/><em>인건비 예산 {Math.round(budget.ratio*100)}% · 근무표 기준 {won(budget.planned)}원 / {won(budget.budget)}원</em></span>}<span className="home-pay-go">급여 자세히 보기</span></button>
  <section className="today-now" aria-labelledby="today-now-title">
   <p className="today-date">{nowLabel}</p>
   <h2 id="today-now-title">{board.working?<>지금 <strong>{board.working}명</strong> 일하는 중</>:board.left?<>오늘 <strong>{board.left}명</strong> 더 출근해요</>:board.rows.length?'오늘 근무가 모두 끝났어요':'오늘은 잡힌 근무가 없어요'}</h2>
   {groups.length>0&&<ul className="today-groups" aria-label="오늘 근무 상태">{groups.map(g=><li key={g.key} className={g.key}>{g.label} <b>{g.n}명</b></li>)}</ul>}
   {board.rows.length>0?<div className="today-list">
    <div className="today-scale" aria-hidden="true">{ticks.map((h,i)=><span key={i} style={{left:pos(h)}}>{h%24}시</span>)}</div>
    <ul>{shown.map(r=><li key={r.id} className={r.status}><div className="today-line"><b>{r.name}</b><span className="today-time">{r.start}{r.end?'–'+r.end:''}</span><span className={'today-pill '+r.status}>{r.label}</span></div><div className="today-track" aria-hidden="true"><span className={'today-bar '+r.status} style={{left:pos(r.from),width:((r.to-r.from)/span*100)+'%'}}/>{board.now!==null&&<span className="today-nowline" style={{left:pos(board.now)}}/>}</div></li>)}</ul>
    {board.rows.length>shown.length&&<p className="today-more">외 {board.rows.length-shown.length}명은 근무표에서 볼 수 있어요.</p>}
   </div>:<p className="today-empty">근무표를 짜 두면 오늘 누가 언제 일하는지 여기서 한눈에 보여요.</p>}
   <div className="today-actions"><button type="button" onClick={onAttendance}>출퇴근 기록 보기</button><button type="button" onClick={onSchedule}>{board.rows.length?'오늘 근무표':'근무표 짜기'}</button></div>
  </section>
  {assistant}
  {children}
  <button className="home-schedule-link" onClick={onJoin||(()=>location.assign('/staff-requests'))}>직원 가입 주소 보내기 · 합류 신청 관리 →</button>
 </div>;
}
