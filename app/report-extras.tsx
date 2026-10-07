'use client';
// 지시서 6주차: 인건비 리포트 추가 — 한 줄 요약, 매출 대비 인건비율, 6개월 추이, 근무표 대비 실제, 요일·시간대별 근무 인원, 인쇄
import {useState} from 'react';
import {type Team,today,calculate,worked,won} from '../lib/team-model';
import {monthsBack,weekdayHourGrid,planVsActual,laborRatio,summaryLines} from '../lib/report-view';

const WD=['월','화','수','목','금','토','일'];
const kd=(iso:string)=>new Date(Date.parse(iso)+9*3600000).toISOString().slice(0,10);

export function ReportExtras({state,branch,month,cost,save}:{state:Team,branch:string,month:string,cost:number,save?:(s:Team)=>Promise<any>}){
 const emps=state.employees.filter(e=>e.branchId===branch),ids=new Set(emps.map(e=>e.id)),names=Object.fromEntries(emps.map(e=>[e.id,e.name]));
 const sales:Record<string,number>=(state.settings as any).monthlySales||{},[draft,setDraft]=useState<string>(sales[month]?String(sales[month]):''),[msg,setMsg]=useState('');
 const shifts=state.shifts.filter(s=>ids.has(s.employeeId));
 // 6개월 추이: 확정된 달은 확정 내역, 아니면 지금 기록으로 다시 계산
 const trend=monthsBack(month,6).map(m=>{const run:any=state.payrollRuns[m+':'+branch];const rows:any[]=run?.locked?run.rows:calculate(state,m).filter(r=>ids.has(r.employeeId)&&r.hours>0);return {m,gross:rows.reduce((n,r)=>n+r.gross,0),hours:rows.reduce((n,r)=>n+r.hours,0),locked:!!run?.locked}});
 const max=Math.max(1,...trend.map(t=>t.gross)),prev=trend[4];
 const actual:Record<string,number>={};for(const a of state.attendance.filter(a=>ids.has(a.employeeId)&&a.end&&kd(a.start).startsWith(month)))actual[a.employeeId]=(actual[a.employeeId]||0)+worked(a);
 const pva=planVsActual(shifts,actual,month,names),grid=weekdayHourGrid(shifts,month),gmax=Math.max(1,...grid.flat());
 const hours=Object.values(actual).reduce((n,v)=>n+v,0),ongoing=month>=today().slice(0,7);
 const lines=summaryLines({month,cost:trend[5].gross,ratioCost:cost,hours,sales:sales[month]},prev.gross?{cost:prev.gross,hours:prev.hours}:null,pva,ongoing);
 const ratio=laborRatio(cost,sales[month]);
 const hoursShown=Array.from({length:24},(_,h)=>h).filter(h=>grid.some(r=>r[h]>0));
 const saveSales=async()=>{if(!save)return;const v=Number(draft.replace(/[^\d]/g,''));const next={...sales};if(v>0)next[month]=v;else delete next[month];if(await save({...state,settings:{...state.settings,monthlySales:next}} as any))setMsg(v>0?'매출을 저장했어요.':'매출을 지웠어요.')};
 return <div className="report-extras">
  <section className="panel t-gap report-summary"><div className="panel-heading"><h2>{Number(month.slice(5))}월 한눈에</h2><button type="button" className="secondary" onClick={()=>window.print()}>인쇄·PDF로 저장</button></div><ul className="t-panelbody">{lines.map(l=><li key={l}>{l}</li>)}</ul></section>
  <section className="panel t-gap"><div className="panel-heading"><h2>매출 대비 인건비율</h2>{ratio!==null&&<span className="report-ratio">{ratio}%</span>}</div><div className="t-panelbody"><div className="t-inline report-sales"><label>{Number(month.slice(5))}월 매출(원) <input inputMode="numeric" value={draft} onChange={e=>setDraft(e.target.value.replace(/[^\d,]/g,''))} placeholder="예: 32000000"/></label>{save&&<button type="button" className="secondary" onClick={saveSales}>저장</button>}</div>{msg&&<p role="status" className="saas-success">{msg}</p>}<p className="footnote">총 인건비 {won(cost)}원 ÷ 매출. 매출은 카드·현금 합계를 직접 적어 주세요. 이 화면에만 쓰고 다른 곳에 보내지 않아요.</p></div></section>
  <section className="panel t-gap"><div className="panel-heading"><h2>6개월 지급액 추이</h2></div><div className="t-panelbody"><div className="report-bars" role="img" aria-label={'월별 지급액: '+trend.map(t=>`${Number(t.m.slice(5))}월 ${won(t.gross)}원`).join(', ')}>{trend.map(t=><div key={t.m} className={'report-bar'+(t.m===month?' cur':'')}><span className="v">{t.gross?Math.round(t.gross/10000).toLocaleString('ko-KR')+'만':'—'}</span><span className="b" style={{height:`${Math.round(t.gross/max*100)}%`}}/><span className="l">{Number(t.m.slice(5))}월{t.locked?'':' *'}</span></div>)}</div><p className="footnote">총 지급액(공제 전) 기준이에요. * 표시는 아직 확정하지 않은 달이라 지금 기록으로 다시 계산한 값이에요.</p></div></section>
  <section className="panel t-gap"><div className="panel-heading"><h2>근무표 대비 실제 근무</h2></div>{pva.length?<div className="t-tablewrap"><table className="t-table"><thead><tr><th>직원</th><th>근무표</th><th>실제(퇴근 완료)</th><th>차이</th></tr></thead><tbody>{pva.map(r=><tr key={r.employeeId}><td>{r.name}</td><td>{r.plan}시간</td><td>{r.actual}시간</td><td className={Math.abs(r.diff)>=4?'report-gap':''}>{r.diff>0?'+':''}{r.diff}시간{Math.abs(r.diff)>=4?' · 확인':''}</td></tr>)}</tbody></table></div>:<p className="t-panelbody">이번 달 근무표나 출퇴근 기록이 없어요.</p>}</section>
  <section className="panel t-gap"><div className="panel-heading"><h2>요일·시간대별 평균 근무 인원</h2></div>{hoursShown.length?<div className="t-tablewrap" tabIndex={0} role="region" aria-label="요일·시간대별 평균 근무 인원 표"><table className="report-heat"><thead><tr><th>요일</th>{hoursShown.map(h=><th key={h}>{h}시</th>)}</tr></thead><tbody>{grid.map((r,w)=><tr key={w}><th>{WD[w]}</th>{hoursShown.map(h=><td key={h} style={{background:`rgba(23,88,63,${(r[h]/gmax*0.35).toFixed(2)})`}}>{r[h]?r[h]:''}</td>)}</tr>)}</tbody></table></div>:<p className="t-panelbody">이번 달 근무표가 없어요.</p>}<p className="footnote t-panelbody">근무표 기준, 그 달 같은 요일의 평균 인원이에요. 숫자가 큰 시간대일수록 진하게 칠했어요.</p></section>
 </div>;
}
