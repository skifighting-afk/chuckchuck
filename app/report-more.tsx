'use client';
// 지시서 나중: 040 급여 시뮬레이터 · 078 근속·퇴사율 · 079 다음 달 인건비 예측 (인건비 리포트 화면)
import {useState} from 'react';
import {type Team,calculate,won,today,datePlus,duration} from '../lib/team-model';
import {plannedLabor} from '../lib/close-check';

const mDiff=(a:string,b:string)=>Math.max(0,(Date.parse(b)-Date.parse(a))/86400000/30.44);
/** 040: 시급을 올리면 이 달 총액이 얼마나 바뀌나 — 저장하지 않고 계산만 */
export function PaySimulator({state,branch,month}:{state:Team,branch:string,month:string}){
 const es=state.employees.filter(e=>e.branchId===branch&&e.status!=='퇴사'),[mode,setMode]=useState<'won'|'pct'|'to'>('won'),[v,setV]=useState('500'),[who,setWho]=useState<'hourly'|'all'>('hourly');
 const n=Number(v)||0,ids=new Set(es.map(e=>e.id));
 const sim=structuredClone(state);for(const e of sim.employees){if(!ids.has(e.id)||(who==='hourly'&&e.payType!=='시급'))continue;e.wage=Math.round(mode==='won'?e.wage+n:mode==='pct'?e.wage*(1+n/100):e.payType==='시급'?Math.max(e.wage,n):e.wage);(e as any).wageHistory=[]}
 const before=calculate(state,month).filter(r=>ids.has(r.employeeId)),after=calculate(sim,month).filter(r=>ids.has(r.employeeId));
 const g0=before.reduce((s,r)=>s+r.gross,0),g1=after.reduce((s,r)=>s+r.gross,0),changed=after.filter(r=>r.gross!==before.find(x=>x.employeeId===r.employeeId)?.gross);
 return <section className="panel t-gap" aria-labelledby="sim-title"><div className="panel-heading"><h2 id="sim-title">급여 시뮬레이터</h2></div><div className="t-panelbody">
  <div className="t-inline sim-row"><label>대상 <select value={who} onChange={e=>setWho(e.target.value as any)}><option value="hourly">시급 직원</option><option value="all">모든 직원(일급·월급 포함)</option></select></label>
   <label>바꾸는 방법 <select value={mode} onChange={e=>setMode(e.target.value as any)}><option value="won">원씩 올리기</option><option value="pct">%만큼 올리기</option><option value="to">이 금액 아래면 맞추기(시급)</option></select></label>
   <label>{mode==='pct'?'%':'원'} <input inputMode="decimal" value={v} onChange={e=>setV(e.target.value.replace(/[^\d.]/g,''))}/></label></div>
  <p className="sim-result">{Number(month.slice(5))}월 근무 그대로라면 총 지급 <b>{won(g0)}원 → {won(g1)}원</b> <span className={g1>g0?'sa-short':'sa-over'}>({g1>=g0?'+':''}{won(g1-g0)}원, {g0?Math.round((g1-g0)/g0*1000)/10:0}%)</span></p>
  {changed.length>0&&<ul className="sim-list">{changed.slice(0,8).map(r=>{const b=before.find(x=>x.employeeId===r.employeeId)!;return <li key={r.employeeId}>{r.name}: {won(b.gross)}원 → {won(r.gross)}원</li>})}</ul>}
  <p className="footnote">주휴·연장·야간 수당까지 다시 계산한 세전 금액이에요(4대보험 사업주 부담은 빠짐). 실제로 바꾸지는 않아요. 바꾸려면 직원 관리의 '급여 일괄 인상'을 쓰세요.</p></div></section>;
}
/** 078: 근속·퇴사율 — 최근 12개월 */
export function Tenure({state,branch}:{state:Team,branch:string}){
 const t=today(),yearAgo=datePlus(t,-365),es=state.employees.filter(e=>e.branchId===branch);
 const left=es.filter(e=>e.status==='퇴사'&&e.endDate&&e.endDate>=yearAgo),active=es.filter(e=>e.status!=='퇴사');
 const avgStay=left.length?left.reduce((s,e)=>s+mDiff(e.joined,e.endDate),0)/left.length:null,early=left.filter(e=>mDiff(e.joined,e.endDate)<3).length;
 const headAvg=(active.length+es.filter(e=>e.status==='퇴사'&&e.endDate&&e.endDate>=yearAgo).length/2)||1,rate=Math.round(left.length/headAvg*100);
 const curAvg=active.length?active.reduce((s,e)=>s+mDiff(e.joined,t),0)/active.length:0;
 return <section className="panel t-gap" aria-labelledby="ten-title"><div className="panel-heading"><h2 id="ten-title">근속·퇴사율 (최근 12개월)</h2></div><div className="t-panelbody">
  <ul className="ten-list"><li>지금 일하는 직원 {active.length}명 · 평균 근속 <b>{curAvg.toFixed(1)}개월</b></li><li>12개월 동안 퇴사 {left.length}명 · 퇴사율 약 <b>{rate}%</b></li>{avgStay!==null&&<li>퇴사한 직원은 평균 <b>{avgStay.toFixed(1)}개월</b> 다녔어요{early?` · 3개월 안에 그만둔 사람 ${early}명`:''}</li>}</ul>
  {early>=2&&<p className="notice">입사 3개월 안에 그만두는 직원이 많아요. 첫 주 교육·매뉴얼·근무 시간을 다시 살펴보세요.</p>}
  <p className="footnote">퇴사율 = 12개월 퇴사자 ÷ 평균 인원(대략). 퇴사일을 적어 둔 직원만 세요.</p></div></section>;
}
/** 079: 다음 달 인건비 예측 — 이미 짠 근무표 + 아직 안 짠 날은 최근 4주 평균 */
export function NextMonthForecast({state,branch,month}:{state:Team,branch:string,month:string}){
 const y=Number(month.slice(0,4)),m=Number(month.slice(5,7)),next=new Date(Date.UTC(y,m,1)).toISOString().slice(0,7),days=new Date(Date.UTC(y,m+1,0)).getUTCDate();
 const es=state.employees.filter(e=>e.branchId===branch&&e.status!=='퇴사'),ids=new Set(es.map(e=>e.id));
 const planned=Math.round(plannedLabor(state,branch,next)),schedDays=new Set(state.shifts.filter(x=>ids.has(x.employeeId)&&x.date.startsWith(next)).map(x=>x.date)).size;
 const t=today(),from=datePlus(t,-28),recent=state.shifts.filter(x=>ids.has(x.employeeId)&&x.date>=from&&x.date<t);
 const perDay=recent.reduce((s,x)=>{const e=es.find(e=>e.id===x.employeeId)!;return s+(e.payType==='시급'?duration(x.start,x.end,x.breakMinutes)*e.wage:e.payType==='일급'?e.wage:0)},0)/28;
 const monthly=es.filter(e=>e.payType==='월급').reduce((s,e)=>s+e.wage,0),hourlyPlanned=planned-monthly;
 const rest=Math.max(0,days-schedDays),est=Math.round(Math.max(0,hourlyPlanned)+perDay*rest+monthly),juhu=Math.round(est*0.12);
 return <section className="panel t-gap" aria-labelledby="fc-title"><div className="panel-heading"><h2 id="fc-title">{Number(next.slice(5))}월 인건비 예측</h2></div><div className="t-panelbody">
  <p className="sim-result">약 <b>{won(est)}원</b> <small>(주휴 등 수당까지 더하면 약 {won(est+juhu)}원)</small></p>
  <ul className="ten-list"><li>근무표에 넣은 {schedDays}일: {won(Math.max(0,hourlyPlanned))}원</li><li>아직 안 짠 {rest}일: 최근 4주 하루 평균 {won(Math.round(perDay))}원으로 추정</li>{monthly>0&&<li>월급 직원: {won(monthly)}원</li>}</ul>
  <p className="footnote">세전 기본급 기준 추정이에요. 주휴·가산 수당은 대략 12%로 더해 봤어요. 근무표를 다 짜면 더 정확해져요.</p></div></section>;
}
