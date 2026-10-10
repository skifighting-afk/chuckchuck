'use client';
// 지시서 '다음' 급여 묶음: 036 주급·격주 정산 · 037 가불·선지급 차감 · 038 퇴직자 최종 정산(14일 D-day, 남은 연차) · 044 퇴사 처리 순서
import {useEffect,useState} from 'react';
import {type Team,kdate,worked,won,today,datePlus} from '../lib/team-model';
import {offboardingChecklist} from '../lib/offboarding';

const md=(d:string)=>`${Number(d.slice(5,7))}/${Number(d.slice(8))}`;
type Adv={id:string,employeeId:string,date:string,amount:number,kind:'가불'|'주급'|'선지급',note?:string,by?:string,at?:string};
const lastDay=(m:string)=>new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7)),0)).toISOString().slice(0,10);
const isLocked=(s:Team,month:string,id:string)=>Object.values(s.payrollRuns).some((r:any)=>r.locked&&r.month===month&&r.rows.some((x:any)=>x.employeeId===id));

/** 037: 가불·선지급 기록 — 그 달 명세서에서 '가불·선지급'으로 빠진다 */
export function AdvancesPanel({s,es,month,busy,save,actor}:{s:Team,es:Team['employees'],month:string,busy:boolean,save:(n:Team)=>Promise<any>,actor?:string}){
 const ids=new Set(es.map(e=>e.id)),list:Adv[]=((s as any).advances||[]).filter((x:Adv)=>ids.has(x.employeeId)&&x.date.startsWith(month)).sort((a:Adv,b:Adv)=>a.date.localeCompare(b.date));
 const [f,setF]=useState<any>(null),[msg,setMsg]=useState('');
 const name=(id:string)=>es.find(e=>e.id===id)?.name||'직원';
 const add=async()=>{const amount=Math.round(Number(String(f.amount).replace(/[^\d]/g,'')));if(!f.employeeId||!(amount>0)){setMsg('직원과 금액을 적어 주세요.');return}if(!f.date.startsWith(month)){setMsg(`${Number(month.slice(5))}월 날짜를 골라 주세요. 다른 달은 위에서 달을 바꿔 넣어 주세요.`);return}if(isLocked(s,month,f.employeeId)){setMsg('이 달 급여가 확정돼 있어요. 확정을 해제한 뒤 넣어 주세요.');return}
  const x:Adv={id:crypto.randomUUID(),employeeId:f.employeeId,date:f.date,amount,kind:f.kind,...(f.note?{note:String(f.note).slice(0,200)}:{}),by:actor||'사장님',at:new Date().toISOString()};
  if(await save({...s,advances:[...((s as any).advances||[]),x]} as any)){setF(null);setMsg(`${name(x.employeeId)}님 ${x.kind} ${won(x.amount)}원을 기록했어요. ${Number(month.slice(5))}월 명세서에서 빠져요.`)}};
 const del=async(x:Adv)=>{if(!confirm(`${name(x.employeeId)}님 ${md(x.date)} ${x.kind} ${won(x.amount)}원 기록을 지울까요?`))return;if(await save({...s,advances:((s as any).advances||[]).filter((y:Adv)=>y.id!==x.id)} as any))setMsg('기록을 지웠어요.')};
 return <section className="panel t-gap adv-panel" aria-labelledby="adv-title"><div className="panel-heading"><h2 id="adv-title">가불·선지급 {list.length?`· ${list.length}건 ${won(list.reduce((n,x)=>n+x.amount,0))}원`:''}</h2><button type="button" className="secondary" onClick={()=>{setMsg('');setF({employeeId:es[0]?.id||'',date:month===today().slice(0,7)?today():month+'-01',amount:'',kind:'가불',note:''})}}>+ 가불 기록</button></div>
  <div className="t-panelbody">
   {f&&<form onSubmit={e=>{e.preventDefault();void add()}}><div className="t-formgrid">
    <label>직원 <select value={f.employeeId} onChange={e=>setF({...f,employeeId:e.target.value})}>{es.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
    <label>종류 <select value={f.kind} onChange={e=>setF({...f,kind:e.target.value})}><option value="가불">가불</option><option value="선지급">선지급</option><option value="주급">주급</option></select></label>
    <label>준 날 <input type="date" required value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></label>
    <label>금액(원) <input inputMode="numeric" required value={f.amount} onChange={e=>setF({...f,amount:e.target.value.replace(/[^\d,]/g,'')})} placeholder="예: 200000"/></label>
    <label>메모(선택) <input maxLength={200} value={f.note} onChange={e=>setF({...f,note:e.target.value})} placeholder="예: 직원 요청, 계좌 이체"/></label></div>
    <div className="actions"><button type="button" className="secondary" onClick={()=>setF(null)}>취소</button><button type="submit" className="primary" disabled={busy}>기록하기</button></div></form>}
   {msg&&<p role="status" className="saas-success">{msg}</p>}
   {list.length?<ul className="adv-list">{list.map(x=><li key={x.id}><b>{name(x.employeeId)}</b> {md(x.date)} {x.kind} <b>{won(x.amount)}원</b>{x.note&&<small> · {x.note}</small>}{!isLocked(s,month,x.employeeId)&&<button type="button" className="link-btn" disabled={busy} onClick={()=>del(x)}>지우기</button>}</li>)}</ul>:!f&&<p className="footnote">미리 준 돈을 기록하면 그 달 명세서 공제에 '가불·선지급'으로 들어가 실수령에서 빠져요. 세금·4대보험은 그 달 총액으로 계산해요.</p>}
   <p className="footnote">가불은 이미 일한 만큼의 임금을 먼저 주는 것이라 공제할 수 있어요. 일하기 전 빌려준 돈(대여금)은 직원 동의 없이 임금에서 뺄 수 없어요(근로기준법 제43조 전액 지급).</p>
  </div></section>;
}

/** 036: 주급·격주 직원 — 그 달 안의 주(또는 2주)마다 완료된 근무로 계산해 지급 기록(=가불·선지급의 '주급')으로 남긴다 */
export function weeklyPeriods(month:string,ws:'mon'|'sun',cycle:'주'|'격주'){
 const first=month+'-01',last=lastDay(month),w=new Date(first+'T00:00:00Z').getUTCDay();let start=datePlus(first,-(ws==='mon'?(w+6)%7:w));
 const weeks:{from:string,to:string,weekEnd:string}[]=[];while(start<=last){const end=datePlus(start,6);weeks.push({from:start<first?first:start,to:end>last?last:end,weekEnd:end});start=datePlus(start,7)}
 if(cycle==='주')return weeks;
 const out:{from:string,to:string,weekEnd:string}[]=[];for(let i=0;i<weeks.length;i+=2){const b=weeks[i+1]||weeks[i];out.push({from:weeks[i].from,to:b.to,weekEnd:b.weekEnd})}return out;
}
export function WeeklySettle({s,es,month,busy,save,actor}:{s:Team,es:Team['employees'],month:string,busy:boolean,save:(n:Team)=>Promise<any>,actor?:string}){
 const ws=((s.settings as any).weekStart||'mon') as 'mon'|'sun',people=es.filter(e=>(e as any).payCycle&&e.payType!=='월급'&&e.status!=='퇴사');
 const [msg,setMsg]=useState('');
 if(!people.length)return null;
 const adv:Adv[]=(s as any).advances||[],t=today();
 const rows=people.flatMap(e=>weeklyPeriods(month,ws,(e as any).payCycle).map(p=>{
  const recs=s.attendance.filter(a=>a.employeeId===e.id&&a.end&&kdate(a.start)>=p.from&&kdate(a.start)<=p.to);
  const h=Math.round(recs.reduce((n,a)=>n+worked(a),0)*100)/100,days=new Set(recs.map(a=>kdate(a.start))).size;
  // 주휴 예상: 그 주가 이 달 안에서 끝날 때만(월 정산과 같은 기준), 주마다 15시간 이상이면 시간 ÷ 40 × 8 × 시급
  let juhu=0;if(e.payType==='시급'&&e.autoPay&&p.weekEnd<=lastDay(month)){for(let k=p.from;k<=p.to;k=datePlus(k,7)){const wk0=datePlus(k,-(ws==='mon'?(new Date(k+'T00:00:00Z').getUTCDay()+6)%7:new Date(k+'T00:00:00Z').getUTCDay())),wh=s.attendance.filter(a=>a.employeeId===e.id&&a.end&&kdate(a.start)>=wk0&&kdate(a.start)<=datePlus(wk0,6)).reduce((n,a)=>n+worked(a),0);if(wh>=15&&datePlus(wk0,6)<=lastDay(month))juhu+=Math.min(wh,40)/40*8*e.wage}}
  const base=e.payType==='일급'?days*e.wage:h*e.wage,amount=Math.round(base+juhu),tag=`${p.from}~${p.to}`,paid=adv.find(x=>x.employeeId===e.id&&x.kind==='주급'&&x.note?.startsWith(tag));
  return {e,p,h,days,juhu:Math.round(juhu),amount,tag,paid,open:p.to>=t}}));
 const pay=async(r:typeof rows[number])=>{if(isLocked(s,month,r.e.id)){setMsg('이 달 급여가 확정돼 있어요. 확정을 해제한 뒤 기록해 주세요.');return}const x:Adv={id:crypto.randomUUID(),employeeId:r.e.id,date:r.p.to>t?(t.startsWith(month)?t:r.p.to):r.p.to,amount:r.amount,kind:'주급',note:`${r.tag} 주급 · ${r.e.payType==='일급'?r.days+'일':r.h+'시간'}${r.juhu?' + 주휴 '+won(r.juhu)+'원':''}`,by:actor||'사장님',at:new Date().toISOString()};
  if(await save({...s,advances:[...adv,x]} as any))setMsg(`${r.e.name}님 ${md(r.p.from)}~${md(r.p.to)} 주급 ${won(r.amount)}원을 지급으로 기록했어요. 월말 명세서에서 빠져요.`)};
 return <section className="panel t-gap weekly-settle" aria-labelledby="wk-title"><div className="panel-heading"><h2 id="wk-title">주급·격주 정산</h2></div><div className="t-tablewrap"><table className="t-table"><thead><tr><th>직원</th><th>기간</th><th>근무</th><th>예상 금액</th><th>지급</th></tr></thead><tbody>
  {rows.map(r=><tr key={r.e.id+r.tag}><td>{r.e.name}<small>{(r.e as any).payCycle==='주'?'매주':'2주마다'}</small></td><td>{md(r.p.from)}~{md(r.p.to)}{r.open&&<small>진행 중</small>}</td><td>{r.e.payType==='일급'?`${r.days}일`:`${r.h}시간`}</td><td><b>{won(r.amount)}원</b>{r.juhu?<small>주휴 {won(r.juhu)}원 포함</small>:null}</td>
   <td>{r.paid?<span className="os-done">✓ {md(r.paid.date)} 지급 {won(r.paid.amount)}원</span>:r.amount>0?<button type="button" className="secondary" disabled={busy||r.open} onClick={()=>pay(r)} title={r.open?'기간이 끝난 뒤 기록할 수 있어요':undefined}>{r.open?'기간 끝난 뒤':'지급 기록'}</button>:<small>근무 없음</small>}</td></tr>)}
 </tbody></table></div><div className="t-panelbody">{msg&&<p role="status" className="saas-success">{msg}</p>}<p className="footnote">완료된 출퇴근의 인정 시간으로 계산한 세전 금액이에요. 연장·야간 가산, 세금·4대보험은 월말 명세서에서 한 번에 정산하고, 매주 준 돈은 '가불·선지급'으로 빠져요. 주급으로 줘도 임금명세서는 매달 줘야 해요.</p></div></section>;
}

/** 038·044: 퇴사자 최종 정산 — 퇴직일+14일 D-day, 순서대로 체크(상실신고 → 최종 급여·연차·퇴직금 → 증명서 → 보관) */
export function OffboardDesk({s,es,busy,save,demo}:{s:Team,es:Team['employees'],busy:boolean,save:(n:Team)=>Promise<any>,demo?:boolean}){
 const t=today(),list=es.filter(e=>e.endDate&&/^\d{4}-\d{2}-\d{2}$/.test(e.endDate)&&datePlus(e.endDate,15)>=datePlus(t,-14)&&e.endDate<=datePlus(t,45));
 const [acc,setAcc]=useState<Record<string,{remaining:number,unusedPay:number,eligible:boolean}>>({}),[msg,setMsg]=useState('');
 useEffect(()=>{if(demo||!list.length)return;let on=true;fetch('/api/operations').then(r=>r.ok?r.json():null).then((d:any)=>{if(on&&d?.employees)setAcc(Object.fromEntries(d.employees.filter((x:any)=>x.accrual).map((x:any)=>[x.id,x.accrual])))}).catch(()=>{});return ()=>{on=false}},[demo,list.length]);
 if(!list.length)return null;
 const done:Record<string,Record<string,string>>=(s as any).offboardDone||{};
 const toggle=async(id:string,title:string,on:boolean)=>{const cur={...(done[id]||{})};if(on)cur[title]=t;else delete cur[title];await save({...s,offboardDone:{...done,[id]:cur}} as any)};
 const addLeavePay=async(e:Team['employees'][number],amount:number,days:number)=>{const m=e.endDate.slice(0,7),k=m+':'+e.id;if(isLocked(s,m,e.id)){setMsg(`${Number(m.slice(5))}월 급여가 이미 확정돼 있어요. 확정을 해제한 뒤 넣어 주세요.`);return}const adj:any=s.adjustments[k]||{earnings:[],deductions:[],note:''};if(adj.earnings.some((x:any)=>x.name==='미사용 연차수당')){setMsg('이미 넣었어요. 급여 화면에서 금액을 확인해 주세요.');return}
  if(await save({...s,adjustments:{...s.adjustments,[k]:{...adj,earnings:[...adj.earnings,{name:'미사용 연차수당',amount,formula:`남은 연차 ${days}일 × 8시간 × 통상시급 (퇴직 정산)`}]}}} as any))setMsg(`${e.name}님 ${Number(m.slice(5))}월 급여에 미사용 연차수당 ${won(amount)}원을 넣었어요.`)};
 const rank=(title:string)=>/상실|자격/.test(title)?0:/급여|연차|퇴직금/.test(title)?1:/증명서/.test(title)?2:3;
 return <section className="panel t-gap offboard-desk" aria-labelledby="ob-title"><div className="panel-heading"><h2 id="ob-title">퇴사 정리 {list.length}명</h2></div><div className="t-panelbody">
  {msg&&<p role="status" className="saas-success">{msg}</p>}
  {list.map(e=>{const c=offboardingChecklist(e as any,e.endDate),due=datePlus(c.retire,14),left=Math.round((Date.parse(due)-Date.parse(t))/86400000),items=c.items.slice().sort((a,b)=>rank(a.title)-rank(b.title)),mine=done[e.id]||{},n=items.filter(x=>mine[x.title]).length,a=acc[e.id];
   return <article key={e.id} className="ob-card"><h3>{e.name} <small>마지막 근무 {md(e.endDate)} · 퇴직일 {md(c.retire)}</small></h3>
    <p className={'ob-dday'+(left<0?' late':left<=3?' near':'')}><b>{left>0?`금품청산 D-${left}`:left===0?'금품청산 오늘까지':`금품청산 기한 ${-left}일 지남`}</b> · {md(due)}까지 임금·연차수당·퇴직금을 모두 지급해야 해요(근로기준법 제36조).</p>
    {a?.eligible&&a.remaining>0&&<p className="ob-leave">남은 연차 {a.remaining}일 · 연차수당 약 {won(a.unusedPay)}원 <button type="button" className="secondary" disabled={busy||!a.unusedPay} onClick={()=>addLeavePay(e,a.unusedPay,a.remaining)}>{Number(e.endDate.slice(5,7))}월 급여에 넣기</button></p>}
    <p><a href={(demo?'/demo?role=owner&screen=hr&view=items':'/hr?view=items')+'&branch='+encodeURIComponent(e.branchId)+'&employee='+encodeURIComponent(e.id)}>이 직원의 지급품·미반납 목록 확인 →</a></p><ol className="ob-steps">{items.map(x=><li key={x.title}><label className="t-check"><input type="checkbox" checked={!!mine[x.title]} disabled={busy} onChange={ev=>toggle(e.id,x.title,ev.target.checked)}/> <b>{x.title}</b>{x.due&&<span className={x.due<t&&!mine[x.title]?'ob-late':''}> · {md(x.due)}까지{x.due<t&&!mine[x.title]?' (지남)':''}</span>}{mine[x.title]&&<small> · {md(mine[x.title])} 완료</small>}</label><small>{x.note}</small></li>)}</ol>
    <p className="footnote">{n}/{items.length} 완료 · 법령 기준 안내예요. 실제 신고 기한과 금액은 관할 기관·노무사와 확인하세요.</p></article>})}
 </div></section>;
}

/** 지시서 049: 시즌 직원 다시 부르기 — 작년에 일한 퇴사자를 한 번에 '입사 준비'로(정보는 그대로, 계약서는 새로) */
export function Rehire({s,es,busy,save}:{s:Team,es:Team['employees'],busy:boolean,save:(n:Team)=>Promise<any>}){
 const t=today(),gone=es.filter(e=>e.status==='퇴사'&&(!e.endDate||e.endDate>=datePlus(t,-730))).sort((a,b)=>(b.endDate||'').localeCompare(a.endDate||''));
 const [pick,setPick]=useState<string[]>([]),[date,setDate]=useState(t),[msg,setMsg]=useState('');
 if(!gone.length)return null;
 const go=async()=>{const ids=new Set(pick);const next={...s,employees:s.employees.map(e=>ids.has(e.id)?{...e,status:'입사 준비' as const,joined:date,endDate:'',leaveReason:'',contract:{...e.contract,status:'작성 전' as any,signedAt:null,signedBy:null}}:e)};if(await save(next as any)){setMsg(`${pick.length}명을 ${md(date)} 입사 준비로 바꿨어요. 근로계약서를 새로 써 주세요.`);setPick([])}};
 return <details className="panel t-gap rehire"><summary>예전 직원 다시 부르기 (시즌 재등록) · {gone.length}명</summary><div className="t-panelbody">
  <p className="footnote">최근 2년 안에 그만둔 직원이에요. 고르면 연락처·급여 정보는 그대로 두고 '입사 준비'로 바꿔요. 근로계약은 새로 맺어야 해요(근로계약서 화면).</p>
  <ul className="adv-list">{gone.map(e=><li key={e.id}><label className="t-check"><input type="checkbox" checked={pick.includes(e.id)} onChange={ev=>setPick(ev.target.checked?[...pick,e.id]:pick.filter(x=>x!==e.id))}/> <b>{e.name}</b> <small>{e.role} · {e.joined}~{e.endDate||'?'}</small></label></li>)}</ul>
  <div className="t-inline"><label>다시 일하는 날 <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button type="button" className="primary" disabled={busy||!pick.length||!date} onClick={go}>{pick.length}명 다시 부르기</button></div>
  {msg&&<p role="status" className="saas-success">{msg}</p>}</div></details>;
}
