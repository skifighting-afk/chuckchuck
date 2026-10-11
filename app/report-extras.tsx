'use client';
// HR 리포트: 급여·근무 기록의 기간, 근거와 정확한 값을 함께 보여 준다.
import {type Team,today,calculate,worked,won} from '../lib/team-model';
import {PaySimulator,Tenure,NextMonthForecast} from './report-more';
import {monthsBack,weekdayHourGrid,planVsActual} from '../lib/report-view';
import {payrollTrendPoint} from '../lib/report-display';
import {durationLabel} from '../lib/payroll-display';

const WD=['월','화','수','목','금','토','일'];
const kd=(iso:string)=>new Date(Date.parse(iso)+9*3600000).toISOString().slice(0,10);

export function ReportExtras({state,branch,month,cost,save}:{state:Team,branch:string,month:string,cost:number,save?:(s:Team)=>Promise<any>}){
 const emps=state.employees.filter(e=>e.branchId===branch),ids=new Set(emps.map(e=>e.id)),names=Object.fromEntries(emps.map(e=>[e.id,e.name]));
 const shifts=state.shifts.filter(s=>ids.has(s.employeeId));
 // 6개월 추이: 확정된 달은 확정 내역, 아니면 지금 기록으로 다시 계산
 const trend=monthsBack(month,6).map(m=>{const run=state.payrollRuns[m+':'+branch];const rows=run?.locked?run.rows:calculate(state,m).filter(r=>ids.has(r.employeeId));const hasRecords=shifts.some(s=>s.date.startsWith(m))||state.attendance.some(a=>ids.has(a.employeeId)&&kd(a.start).startsWith(m));return payrollTrendPoint(m,rows,!!run?.locked,hasRecords)});
 const max=Math.max(1,...trend.map(t=>t.gross)),current=trend[5],branchName=state.branches.find(b=>b.id===branch)?.name||'선택한 매장';
 const actual:Record<string,number>={};for(const a of state.attendance.filter(a=>ids.has(a.employeeId)&&a.end&&kd(a.start).startsWith(month)))actual[a.employeeId]=(actual[a.employeeId]||0)+worked(a);
 const pva=planVsActual(shifts,actual,month,names),grid=weekdayHourGrid(shifts,month),gmax=Math.max(1,...grid.flat());
 const hours=Object.values(actual).reduce((n,v)=>n+v,0),ongoing=month>=today().slice(0,7);
 const lines=current.hasData?[`${month} ${current.status} 합계는 공제 전 ${won(current.gross)}원이에요.`,`${ongoing?'진행 중인 달이에요. ':''}퇴근을 완료한 기록은 ${durationLabel(hours)}예요.`,...(pva.some(r=>Math.abs(r.diff)>=4)?['근무표와 기록의 차이가 큰 직원은 아래 비교표에서 확인해 주세요.']:[])]:['이 달에는 급여 계산에 쓸 근무 기록이 없어요. 근무표와 출퇴근 기록을 먼저 확인해 주세요.'];
 const hoursShown=Array.from({length:24},(_,h)=>h).filter(h=>grid.some(r=>r[h]>0));
 return <div className="report-extras">
  <section className="panel t-gap report-summary"><div className="panel-heading"><h2>{Number(month.slice(5))}월 한눈에</h2><button type="button" className="secondary" onClick={()=>window.print()}>인쇄·PDF로 저장</button></div><ul className="t-panelbody">{lines.map(l=><li key={l}>{l}</li>)}</ul></section>
  <section className="panel t-gap report-trend" aria-labelledby="report-trend-title">
   <div className="panel-heading"><h2 id="report-trend-title">최근 6개월, 급여가 어떻게 달라졌나요?</h2></div>
   <div className="t-panelbody"><p className="report-basis">{branchName} · {trend[0].month} ~ {month} · 월별 총 지급액, 공제 전 원</p>
    <div className="report-bars" aria-hidden="true">{trend.map(t=><div key={t.month} className={'report-bar'+(t.month===month?' cur':'')+(!t.hasData?' empty':'')}><span className="v">{t.hasData?won(t.gross)+'원':'기록 없음'}</span><span className="b" style={{height:t.hasData?Math.max(0,Math.round(t.gross/max*100))+'%':'0%'}}/><span className="l">{Number(t.month.slice(5))}월</span><span className="report-stage">{t.status}</span></div>)}</div>
    <p className="footnote">확정은 저장한 급여 내역, 예상은 현재 근무·급여 조건으로 계산한 값이에요. 송금 완료를 뜻하지 않아요. 직원 수와 근무량이 달라질 수 있어 월 합계만으로 업무 효율을 판단하지 않아요.</p>
   </div>
   <div className="t-tablewrap" tabIndex={0} role="region" aria-label="월별 급여 정확한 값"><table className="t-table report-trend-table"><caption>{branchName} 월별 급여 · 공제 전</caption><thead><tr><th scope="col">기간</th><th scope="col">총 지급액</th><th scope="col">계산 근무시간</th><th scope="col">급여 계산 직원</th><th scope="col">근거</th></tr></thead><tbody>{trend.map(t=><tr key={t.month}><th scope="row">{t.month}</th><td>{t.hasData?won(t.gross)+'원':'—'}</td><td>{t.hasData?durationLabel(t.hours):'—'}</td><td>{t.hasData?t.staff+'명':'—'}</td><td><span className={'report-basis-state'+(t.status==='확정 급여'?' confirmed':'')}>{t.status}</span></td></tr>)}</tbody></table></div>
  </section>
  <section className="panel t-gap"><div className="panel-heading"><h2>근무표 대비 실제 근무</h2></div>{pva.length?<div className="t-tablewrap"><table className="t-table"><thead><tr><th>직원</th><th>근무표</th><th>실제(퇴근 완료)</th><th>차이</th></tr></thead><tbody>{pva.map(r=><tr key={r.employeeId}><td>{r.name}</td><td>{r.plan}시간</td><td>{r.actual}시간</td><td className={Math.abs(r.diff)>=4?'report-gap':''}>{r.diff>0?'+':''}{r.diff}시간{Math.abs(r.diff)>=4?' · 확인':''}</td></tr>)}</tbody></table></div>:<p className="t-panelbody">이번 달 근무표나 출퇴근 기록이 없어요.</p>}</section>
  <NextMonthForecast state={state} branch={branch} month={month}/>
  <PaySimulator state={state} branch={branch} month={month}/>
  <Tenure state={state} branch={branch}/>
  <AllowanceTrend state={state} ids={ids} month={month}/>
  <section className="panel t-gap"><div className="panel-heading"><h2>요일·시간대별 평균 근무 인원</h2></div>{hoursShown.length?<div className="t-tablewrap" tabIndex={0} role="region" aria-label="요일·시간대별 평균 근무 인원 표"><table className="report-heat"><thead><tr><th>요일</th>{hoursShown.map(h=><th key={h}>{h}시</th>)}</tr></thead><tbody>{grid.map((r,w)=><tr key={w}><th>{WD[w]}</th>{hoursShown.map(h=><td key={h} style={{background:`rgba(23,88,63,${(r[h]/gmax*0.35).toFixed(2)})`}}>{r[h]?r[h]:''}</td>)}</tr>)}</tbody></table></div>:<p className="t-panelbody">이번 달 근무표가 없어요.</p>}<p className="footnote t-panelbody">근무표 기준, 그 달 같은 요일의 평균 인원이에요. 숫자가 큰 시간대일수록 진하게 칠했어요.</p></section>
 </div>;
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
