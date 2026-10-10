'use client';
// 지시서 093 지점 간 지원 근무 배분 · 096 지점별 준수 현황 (매장 관리·비교 화면)
import {useEffect,useState} from 'react';
import {type Team,calculate,won,today} from '../lib/team-model';
import {branchAllocation,branchCompliance} from '../lib/branch-support';
import {weekStartOf} from '../lib/schedule-rules';

export function BranchMore({state,month,outbox}:{state:Team,month:string,outbox?:any[]}){
 if(state.branches.length<2)return null;
 const pay=calculate(state,month),gross=Object.fromEntries(pay.map(r=>[r.employeeId,r.gross]));
 const alloc=branchAllocation(state.employees as any,state.shifts as any,state.attendance as any,month,gross);
 const support=Object.values(alloc).some(v=>v.supportIn>0);
 const t=today(),ws=((state.settings as any).weekStart||'mon') as 'mon'|'sun',wk=weekStartOf(t,ws);
 const comp=state.branches.map(b=>{const runs=Object.values(state.payrollRuns).filter((r:any)=>r.locked&&r.branch===b.id).sort((a:any,c:any)=>c.month.localeCompare(a.month)) as any[],last=runs[0];
  const sent=last?(outbox||[]).filter((m:any)=>String(m.key||'').startsWith(last.month+':'+b.id+':')&&m.status==='발송 접수').length:0;
  return {b,last,c:branchCompliance(b.id,state.employees as any,{today:t,lastRun:last?{rows:last.rows,sent}:null,published:!!(state as any).publishedWeeks?.[b.id+':'+wk]})}});
 const mark=(ok:boolean)=><span aria-hidden="true">{ok?'✓ ':'⚠ '}</span>;
 return <>
  <section className="panel t-gap" aria-labelledby="bc-title"><div className="panel-heading"><h2 id="bc-title">지점별 준수 현황</h2></div><div className="t-tablewrap"><table className="t-table"><thead><tr><th>지점</th><th>재직</th><th>근로계약 체결</th><th>명세서 발송(최근 확정 달)</th><th>보건증 만료·임박</th><th>연소자 서류</th><th>이번 주 근무표 공개</th></tr></thead><tbody>
   {comp.map(({b,last,c})=><tr key={b.id}><th scope="row">{b.name}</th><td>{c.staff}명</td><td className={c.unsigned?'report-gap':''}>{mark(!c.unsigned)}{c.contractRate}%{c.unsigned?` · ${c.unsigned}명 미체결`:''}</td><td>{c.payslipRate===null?'확정 전':<>{mark(c.payslipRate>=100)}{c.payslipRate}% <small>({last.month})</small></>}</td><td className={c.health?'report-gap':''}>{mark(!c.health)}{c.health?`${c.health}명`:'없음'}</td><td className={c.minorsMissing?'report-gap':''}>{mark(!c.minorsMissing)}{c.minorsMissing?`${c.minorsMissing}명 미비`:'문제 없음'}</td><td>{mark(c.published)}{c.published?'공개함':'공개 전'}</td></tr>)}
  </tbody></table></div><p className="footnote t-panelbody">명세서 발송은 앱에서 이메일로 보낸 건만 세요(직접 준 경우는 빠져요). ⚠ 표시가 있으면 그 지점을 눌러 확인해 주세요.</p></section>
  <section className="panel t-gap" aria-labelledby="ba-title"><div className="panel-heading"><h2 id="ba-title">{Number(month.slice(5))}월 지점별 인건비 배분</h2></div>
   {support?<div className="t-tablewrap"><table className="t-table"><thead><tr><th>지점</th><th>소속 직원 근무</th><th>다른 지점에서 지원 옴</th><th>다른 지점에 지원 감</th><th>배분한 인건비</th></tr></thead><tbody>{state.branches.map(b=>{const v=alloc[b.id]||{own:0,supportIn:0,supportOut:0,cost:0};return <tr key={b.id}><th scope="row">{b.name}</th><td>{v.own}시간</td><td>{v.supportIn}시간</td><td>{v.supportOut}시간</td><td><b>{won(v.cost)}원</b></td></tr>})}</tbody></table></div>
   :<p className="t-panelbody">이번 달 지원 근무가 없어요. 근무를 넣을 때 '근무 지점'을 다른 지점으로 고르면 그 시간만큼 인건비를 그 지점으로 나눠 보여 줘요.</p>}
   <p className="footnote t-panelbody">급여는 소속 지점에서 한 번에 줘요. 이 표는 지점별 손익을 볼 수 있게 일한 시간 비율로 나눈 참고값이에요.</p></section>
 </>;
}

/** 지시서 094·095: 내가 관리하는 여러 가게(내 가게 + 공동 관리)에 본사 공지 한 번에 · 표준 템플릿 복제 */
export function MultiStorePanel({demo}:{demo:boolean}){
 const [stores,setStores]=useState<any[]>([]),[pick,setPick]=useState<string[]>([]),[mode,setMode]=useState<'notice'|'copy'>('notice'),[f,setF]=useState({title:'',body:'',from:'',kinds:['manuals']}),[msg,setMsg]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(demo)return;fetch('/api/multi-store').then(r=>r.json()).then((d:any)=>{setStores(d.stores||[]);setPick((d.stores||[]).map((x:any)=>x.owner));setF(v=>({...v,from:d.stores?.[0]?.owner||''}))}).catch(()=>{})},[demo]);
 if(demo||stores.length<2)return null;
 const send=async()=>{setBusy(true);setMsg('');setErr('');try{const r=await fetch('/api/multi-store',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mode==='notice'?{action:'notice',targets:pick,title:f.title,body:f.body}:{action:'copy',targets:pick,from:f.from,kinds:f.kinds})});const d:any=await r.json();if(!r.ok)throw Error(d.error||'보내지 못했어요.');setMsg(`${d.done.join(', ')||'없음'}에 ${mode==='notice'?'공지를 올렸어요':'복사했어요'}.${d.failed.length?` ${d.failed.join(', ')}은 실패했어요. 다시 해 주세요.`:''}`);if(mode==='notice')setF({...f,title:'',body:''})}catch(e){setErr((e as Error).message)}finally{setBusy(false)}};
 const K=[['needs','시간대별 필요 인원'],['rules','출퇴근 인정 규칙·허용 오차·주 시작 요일·자동 게시'],['manuals','매장 매뉴얼(같은 제목은 건너뜀)']];
 return <section className="panel t-gap multi-store" aria-labelledby="ms-title"><div className="panel-heading"><h2 id="ms-title">여러 가게 한 번에 ({stores.length}곳)</h2></div><HqReads demo={demo}/><div className="t-panelbody">
  <div className="att-views" role="group" aria-label="할 일"><button type="button" aria-pressed={mode==='notice'} onClick={()=>setMode('notice')}>본사 공지 보내기</button><button type="button" aria-pressed={mode==='copy'} onClick={()=>setMode('copy')}>표준 템플릿 복사</button></div>
  <fieldset className="slog-who"><legend>받을 가게</legend>{stores.map(x=><label key={x.owner} className="t-check"><input type="checkbox" checked={pick.includes(x.owner)} onChange={e=>setPick(e.target.checked?[...pick,x.owner]:pick.filter(o=>o!==x.owner))}/> {x.name}{x.access==='coowner'?' (공동 관리)':''}</label>)}</fieldset>
  {mode==='notice'?<><label className="slog-field">제목 <input maxLength={80} value={f.title} onChange={e=>setF({...f,title:e.target.value})}/></label><label className="slog-field">내용 <textarea rows={4} maxLength={2000} value={f.body} onChange={e=>setF({...f,body:e.target.value})}/></label><p className="footnote">고른 가게의 '휴가·공지'에 '본사' 이름으로 올라가고, 그 가게 직원에게 알림이 가요.</p></>
  :<><label className="slog-field">어느 가게 것을 <select value={f.from} onChange={e=>setF({...f,from:e.target.value})}>{stores.map(x=><option key={x.owner} value={x.owner}>{x.name}</option>)}</select></label><fieldset className="slog-who"><legend>복사할 것</legend>{K.map(([k,l])=><label key={k} className="t-check"><input type="checkbox" checked={f.kinds.includes(k)} onChange={e=>setF({...f,kinds:e.target.checked?[...f.kinds,k]:f.kinds.filter(x=>x!==k)})}/> {l}</label>)}</fieldset><p className="footnote">근로계약서는 모든 가게가 같은 앱 표준 양식을 써요. 근무표는 직원이 달라서 복사하지 않고, 필요 인원 기준을 복사해 '가능 시간으로 초안'에서 바로 짜요.</p></>}
  <button type="button" className="primary" disabled={busy||!pick.length||(mode==='notice'?!f.title.trim()||!f.body.trim():!f.kinds.length||!f.from)} onClick={send}>{busy?'보내는 중…':mode==='notice'?`${pick.length}곳에 공지 올리기`:`${pick.filter(o=>o!==f.from).length}곳에 복사`}</button>
  {msg&&<p role="status" className="saas-success">{msg}</p>}{err&&<p role="alert" className="saas-error">{err}</p>}</div></section>;
}

/** 개선 2차 B163 본사 공지 가게별 읽음 */
function HqReads({demo}:{demo?:boolean}){const [rows,setRows]=useState<any[]|null>(null);if(demo)return null;
 return <details className="t-panelbody" onToggle={e=>{if((e.target as HTMLDetailsElement).open&&!rows)fetch('/api/multi-store?reads=1').then(r=>r.json()).then((d:any)=>setRows(d.reads||[])).catch(()=>setRows([]))}}><summary>본사 공지 가게별 읽음</summary>{!rows?<p className="footnote">불러오는 중…</p>:rows.length?<ul>{rows.map((r,i)=><li key={i}>{r.store} · {r.title} · <b>{r.read}/{r.total}명</b> 읽음</li>)}</ul>:<p className="footnote">아직 본사 공지가 없어요.</p>}</details>}
