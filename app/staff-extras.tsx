'use client';
// 지시서 8주차: 직원 화면 — 이번 주 주휴 조건 진행, 이번 달 예상 급여, 내 근무 달력, 증명서 요청
import {useState} from 'react';
import {type Team,today,calculate,won} from '../lib/team-model';
import {weekProgress,myMonth} from '../lib/staff-home';

export function StaffWeek({state,selfId}:{state:Team,selfId:string}){
 const p=weekProgress(state.attendance.filter(a=>a.employeeId===selfId) as any,state.shifts.filter(s=>s.employeeId===selfId),Date.now(),((state.settings as any).weekStart||'mon'));
 return <section className="staff-week" aria-label="이번 주 근무 시간"><div className="sw-head"><b>이번 주 {p.done}시간</b><span>주휴수당 기준 15시간</span></div><div className="sw-bar" role="progressbar" aria-valuemin={0} aria-valuemax={15} aria-valuenow={Math.min(15,p.done)} aria-label="이번 주 근무 시간"><span style={{width:p.pct+'%'}}/></div><p>{p.text}</p></section>;
}
export function PayEstimate({state,selfId}:{state:Team,selfId:string}){
 if((state.settings as any).staffPayEstimate===false)return null;
 const m=today().slice(0,7);let r:any=null;try{r=calculate(state,m).find(x=>x.employeeId===selfId)}catch{}
 if(!r||(!r.hours&&!r.gross))return null;
 return <section className="staff-pay-est" aria-label="이번 달 예상 급여"><span>{Number(m.slice(5))}월 지금까지 예상 급여</span><b>약 {won(Math.floor(r.gross/1000)*1000)}원</b><small>공제 전 · 퇴근까지 찍은 기록만 · 확정 전이라 바뀔 수 있어요 ({Math.round(r.hours*10)/10}시간)</small></section>;
}
const WD=['일','월','화','수','목','금','토'];
export function MyCalendar({state,selfId}:{state:Team,selfId:string}){
 const [month,setMonth]=useState(today().slice(0,7)),[pick,setPick]=useState('');
 const c=myMonth(month,state.attendance.filter(a=>a.employeeId===selfId) as any,state.shifts.filter(s=>s.employeeId===selfId),Date.now());
 const mv=(n:number)=>{const [y,mo]=month.split('-').map(Number),d=new Date(Date.UTC(y,mo-1+n,1));setMonth(d.toISOString().slice(0,7));setPick('')};
 const sel=c.days.find(d=>d.date===pick);
 return <section className="panel t-gap my-cal" aria-label="내 근무 달력"><div className="panel-heading"><h2>내 근무 달력</h2></div>
  <div className="my-cal-nav"><button type="button" className="secondary" onClick={()=>mv(-1)} aria-label="이전 달">←</button><b>{month.slice(0,4)}년 {Number(month.slice(5))}월 · {c.workedDays}일 {c.total}시간</b><button type="button" className="secondary" onClick={()=>mv(1)} aria-label="다음 달">→</button></div>
  <div className="my-cal-grid" role="grid">{WD.map(w=><span key={w} className="my-cal-h" role="columnheader">{w}</span>)}{Array.from({length:c.lead},(_,i)=><span key={'x'+i}/>)}{c.days.map(d=><button type="button" key={d.date} className={'my-cal-d'+(d.state?' s-'+({'근무함':'ok','근무 중':'now','퇴근 기록 없음':'warn','기록 없음':'miss','예정':'plan'} as any)[d.state]:'')+(d.date===today()?' today':'')+(pick===d.date?' on':'')} onClick={()=>setPick(pick===d.date?'':d.date)} aria-label={`${Number(d.date.slice(8))}일 ${d.state||'근무 없음'}${d.hours?` ${d.hours}시간`:''}`}><span className="n">{Number(d.date.slice(8))}</span>{d.hours>0?<span className="h">{d.hours}h</span>:d.state==='예정'?<span className="h">예정</span>:d.state==='기록 없음'?<span className="h">없음</span>:null}</button>)}</div>
  {sel&&<p className="my-cal-sel" role="status"><b>{Number(sel.date.slice(5,7))}월 {Number(sel.date.slice(8))}일</b> {sel.plan.length?`근무표 ${sel.plan.join(', ')}`:'근무표 없음'} · {sel.state||'기록 없음'}{sel.hours?` · ${sel.hours}시간`:''}</p>}
  <p className="footnote">글자로 상태를 보여 줘요: 숫자(h)=일한 시간, 예정=앞으로 근무, 없음=근무표는 있는데 출퇴근 기록이 없음.</p></section>;
}
export function CertRequest({demo,mutate,busy}:{demo:boolean,mutate:(b:any)=>Promise<boolean>,busy:boolean}){
 const [kind,setKind]=useState<'재직'|'경력'>('재직'),[purpose,setPurpose]=useState(''),[sent,setSent]=useState(false);
 return <section className="panel t-gap cert-req" aria-label="증명서 요청"><div className="panel-heading"><h2>재직·경력증명서 요청</h2></div><div className="t-panelbody">
  {sent?<p className="pc-ok" role="status">✓ 사장님께 요청을 보냈어요. 사장님이 발급하면 받아 볼 수 있어요.</p>:<>
  <div className="t-inline" role="group" aria-label="증명서 종류"><label><input type="radio" name="cert" checked={kind==='재직'} onChange={()=>setKind('재직')}/> 재직증명서</label><label><input type="radio" name="cert" checked={kind==='경력'} onChange={()=>setKind('경력')}/> 경력증명서</label></div>
  <label className="cert-purpose">쓰실 곳 <input value={purpose} maxLength={60} onChange={e=>setPurpose(e.target.value)} placeholder="예: 은행 제출용"/></label>
  <button type="button" className="primary" disabled={busy} onClick={async()=>{if(await mutate({action:'requestCertificate',kind,purpose:purpose.trim()}))setSent(true)}}>사장님께 요청하기</button>{demo&&<small>체험 화면에서는 보내지 않아요.</small>}</>}
 </div></section>;
}
