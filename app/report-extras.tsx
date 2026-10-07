'use client';
// 지시서 6주차: 인건비 리포트 추가 — 한 줄 요약, 매출 대비 인건비율, 6개월 추이, 근무표 대비 실제, 요일·시간대별 근무 인원, 인쇄
import {useState} from 'react';
import {type Team,today,calculate,worked,won} from '../lib/team-model';
import {PaySimulator,Tenure,NextMonthForecast} from './report-more';
import {monthsBack,weekdayHourGrid,planVsActual,laborRatio,summaryLines,parseSalesCsv,staffingAdvice} from '../lib/report-view';

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
  <section className="panel t-gap"><div className="panel-heading"><h2>매출 대비 인건비율</h2>{ratio!==null&&<span className="report-ratio">{ratio}%</span>}</div><div className="t-panelbody"><div className="t-inline report-sales"><label>{Number(month.slice(5))}월 매출(원) <input inputMode="numeric" value={draft} onChange={e=>setDraft(e.target.value.replace(/[^\d,]/g,''))} placeholder="예: 32000000"/></label>{save&&<button type="button" className="secondary" onClick={saveSales}>저장</button>}</div>{save&&<label className="sd-file report-pos"><input type="file" accept=".csv,text/csv,text/plain" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;const r=parseSalesCsv(await f.text());if(!r.rows){setMsg('파일에서 날짜와 금액을 찾지 못했어요. 날짜·금액 칸이 있는 CSV를 골라 주세요.');return}const next={...sales,...r.sums},hs={...((state.settings as any).hourlySales||{}),...r.hourly},keep=Object.fromEntries(Object.entries(hs).sort().slice(-6));if(await save({...state,settings:{...state.settings,monthlySales:next,...(r.timed?{hourlySales:keep}:{})}} as any)){setDraft(next[month]?String(next[month]):draft);setMsg(`매출 파일 ${r.rows}줄을 읽어 ${Object.keys(r.sums).map(m=>Number(m.slice(5))+'월').join('·')} 매출을 넣었어요.${r.timed?' 결제 시각이 있어 시간대별 적정 인원도 계산했어요.':''}`)}}}/>POS·카드 매출 파일(CSV) 올리기</label>}{msg&&<p role="status" className="saas-success">{msg}</p>}<p className="footnote">총 인건비 {won(cost)}원 ÷ 매출. 매출은 카드·현금 합계를 직접 적어 주세요. 이 화면에만 쓰고 다른 곳에 보내지 않아요.</p></div></section>
  <section className="panel t-gap"><div className="panel-heading"><h2>6개월 지급액 추이</h2></div><div className="t-panelbody"><div className="report-bars" role="img" aria-label={'월별 지급액: '+trend.map(t=>`${Number(t.m.slice(5))}월 ${won(t.gross)}원`).join(', ')}>{trend.map(t=><div key={t.m} className={'report-bar'+(t.m===month?' cur':'')}><span className="v">{t.gross?Math.round(t.gross/10000).toLocaleString('ko-KR')+'만':'—'}</span><span className="b" style={{height:`${Math.round(t.gross/max*100)}%`}}/><span className="l">{Number(t.m.slice(5))}월{t.locked?'':' *'}</span></div>)}</div><p className="footnote">총 지급액(공제 전) 기준이에요. * 표시는 아직 확정하지 않은 달이라 지금 기록으로 다시 계산한 값이에요.</p></div></section>
  <section className="panel t-gap"><div className="panel-heading"><h2>근무표 대비 실제 근무</h2></div>{pva.length?<div className="t-tablewrap"><table className="t-table"><thead><tr><th>직원</th><th>근무표</th><th>실제(퇴근 완료)</th><th>차이</th></tr></thead><tbody>{pva.map(r=><tr key={r.employeeId}><td>{r.name}</td><td>{r.plan}시간</td><td>{r.actual}시간</td><td className={Math.abs(r.diff)>=4?'report-gap':''}>{r.diff>0?'+':''}{r.diff}시간{Math.abs(r.diff)>=4?' · 확인':''}</td></tr>)}</tbody></table></div>:<p className="t-panelbody">이번 달 근무표나 출퇴근 기록이 없어요.</p>}</section>
  <NextMonthForecast state={state} branch={branch} month={month}/>
  <PaySimulator state={state} branch={branch} month={month}/>
  <StaffingAdvice state={state} month={month} grid={grid} save={save}/>
  <Tenure state={state} branch={branch}/>
  <AllowanceTrend state={state} ids={ids} month={month}/>
  <section className="panel t-gap"><div className="panel-heading"><h2>요일·시간대별 평균 근무 인원</h2></div>{hoursShown.length?<div className="t-tablewrap" tabIndex={0} role="region" aria-label="요일·시간대별 평균 근무 인원 표"><table className="report-heat"><thead><tr><th>요일</th>{hoursShown.map(h=><th key={h}>{h}시</th>)}</tr></thead><tbody>{grid.map((r,w)=><tr key={w}><th>{WD[w]}</th>{hoursShown.map(h=><td key={h} style={{background:`rgba(23,88,63,${(r[h]/gmax*0.35).toFixed(2)})`}}>{r[h]?r[h]:''}</td>)}</tr>)}</tbody></table></div>:<p className="t-panelbody">이번 달 근무표가 없어요.</p>}<p className="footnote t-panelbody">근무표 기준, 그 달 같은 요일의 평균 인원이에요. 숫자가 큰 시간대일수록 진하게 칠했어요.</p></section>
 </div>;
}

/** 075: 시간대별 적정 인원(매출 기준) — 결제 시각이 있는 매출 파일을 올리면 */
function StaffingAdvice({state,month,grid,save}:{state:Team,month:string,grid:number[][],save?:(s:Team)=>Promise<any>}){
 const per:number=(state.settings as any).salesPerStaffHour||60000,[draft,setDraft]=useState(String(per));
 const h=((state.settings as any).hourlySales||{})[month],list=staffingAdvice(h,grid,per),off=list.filter(x=>x.gap<=-0.5||x.gap>=1).sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap)).slice(0,12);
 return <section className="panel t-gap" aria-labelledby="sa-title"><div className="panel-heading"><h2 id="sa-title">시간대별 적정 인원 (매출 기준)</h2></div><div className="t-panelbody">
  {!h?<p className="footnote">POS·카드 매출 파일에 결제 시각(예: 2026-09-01 13:25)이 있으면, 요일·시간대마다 평균 매출로 필요한 인원을 계산해 지금 근무표와 비교해 드려요. 위 '매출 대비 인건비율'에서 파일을 올려 주세요.</p>:<>
   <div className="t-inline"><label>직원 1명이 1시간에 맡는 매출(원) <input inputMode="numeric" value={draft} onChange={e=>setDraft(e.target.value.replace(/[^\d]/g,''))}/></label>{save&&<button type="button" className="secondary" disabled={!Number(draft)||Number(draft)===per} onClick={()=>save({...state,settings:{...state.settings,salesPerStaffHour:Number(draft)}} as any)}>저장</button>}</div>
   {off.length?<ul className="sa-list">{off.map(x=><li key={x.w+'-'+x.hour}><b>{WD[x.w]} {x.hour}시</b> 평균 매출 {won(x.sales)}원 · 지금 {x.have}명 · 적정 {x.need}명 <span className={x.gap<0?'sa-short':'sa-over'}>{x.gap<0?`▼ ${Math.abs(x.gap)}명 부족`:`▲ ${x.gap}명 여유`}</span></li>)}</ul>:<p className="pc-ok">✓ 시간대마다 근무 인원이 매출에 맞아요.</p>}
   <p className="footnote">근무표 평균 인원과 그 시간 평균 매출로 낸 참고값이에요. 준비·마감, 배달 같은 일은 매출에 안 잡혀요.</p></>}
 </div></section>;
}
/** 077: 수당 발생 분석 — 최근 3개월 주휴·연장·야간·휴일 가산, 공휴일 수당(근무표·출퇴근으로 다시 계산, 확정 달은 확정 내역) */
const KINDS=['주휴수당','연장근로 가산','야간근로 가산','휴일근로 가산','공휴일 유급휴일수당'];
function AllowanceTrend({state,ids,month}:{state:Team,ids:Set<string>,month:string}){
 const months=monthsBack(month,3),data=months.map(m=>{const runs=Object.values(state.payrollRuns).filter((r:any)=>r.locked&&r.month===m) as any[];const rows:any[]=runs.length?runs.flatMap(r=>r.rows).filter((r:any)=>ids.has(r.employeeId)):calculate(state,m).filter(r=>ids.has(r.employeeId)&&r.hours>0);
  const by:Record<string,number>={},per:Record<string,Record<string,number>>={};for(const r of rows)for(const e of r.earnings||[])if(KINDS.includes(e.name)){by[e.name]=(by[e.name]||0)+e.amount;(per[r.name]||={})[e.name]=((per[r.name]||{})[e.name]||0)+e.amount}
  return {m,by,per,total:Object.values(by).reduce((n,v)=>n+v,0),gross:rows.reduce((n,r)=>n+r.gross,0)}});
 const cur=data[2],kinds=KINDS.filter(k=>data.some(d=>d.by[k]));
 return <section className="panel t-gap" aria-labelledby="at-title"><div className="panel-heading"><h2 id="at-title">수당 발생 분석</h2></div>
  {kinds.length?<><div className="t-tablewrap"><table className="t-table"><thead><tr><th>수당</th>{data.map(d=><th key={d.m}>{Number(d.m.slice(5))}월</th>)}</tr></thead><tbody>{kinds.map(k=><tr key={k}><th scope="row">{k}</th>{data.map(d=><td key={d.m}>{d.by[k]?won(d.by[k])+'원':'—'}</td>)}</tr>)}<tr><th scope="row">합계 (총 지급 중 비율)</th>{data.map(d=><td key={d.m}><b>{won(d.total)}원</b>{d.gross?<small> ({Math.round(d.total/d.gross*1000)/10}%)</small>:null}</td>)}</tr></tbody></table></div>
   {Object.keys(cur.per).length>0&&<p className="t-panelbody">{Number(month.slice(5))}월 많이 생긴 사람: {Object.entries(cur.per).map(([n,v])=>[n,Object.values(v).reduce((a,b)=>a+b,0)] as const).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n,v])=>`${n} ${won(v)}원`).join(', ')}</p>}
   <p className="footnote t-panelbody">연장·야간·휴일 가산은 5명 이상 사업장만 붙어요. 주 15시간을 살짝 넘기는 근무, 밤 10시 넘는 마감이 많으면 근무표를 조정해 볼 수 있어요.</p></>
  :<p className="t-panelbody">최근 3개월 동안 생긴 주휴·가산 수당이 없어요.</p>}</section>;
}
