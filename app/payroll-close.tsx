'use client';
// 지시서 4주차: 급여 화면의 마감 도우미 — 지급 완료 기록, 재확정 때 바뀐 점, 지난달 대비, 확정 이력, 수당·공제 한꺼번에 넣기
import {useState} from 'react';
import {type Team,today} from '../lib/team-model';
import {payAudit} from '../lib/pay-audit';
import {deadlinesFor,durunuriCandidates,DURUNURI_LIMIT} from '../lib/tax-calendar';
import {holidaysFor} from '../lib/holidays';
import {compareMonths,revisionDiff,paidSummary,bulkAdjust,prevMonthOf,signed,won,bankTransferCsv} from '../lib/payroll-close';
import {saveFile} from './team-ui';

const md=(d:string)=>`${Number(d.slice(5,7))}/${Number(d.slice(8,10))}`;
const when=(iso:string)=>{const k=new Date(Date.parse(iso)+9*3600000).toISOString();return `${md(k)} ${k.slice(11,16)}`};

/** 지난달 실수령과 비교(표의 한 칸) */
export function compareFor(s:Team,month:string,branch:string,payRows:any[],calc:(m:string)=>any[]){
 const pm=prevMonthOf(month),pr=s.payrollRuns[pm+':'+branch] as any;
 // 지난달이 확정됐으면 확정 내역, 아니면 근무 기록이 있는 직원만 다시 계산해 비교(기록이 없으면 '신규'라 하지 않는다)
 const prev=pr?.locked?pr.rows:calc(pm).filter((r:any)=>r.branchId===branch&&r.hours>0);
 const out=compareMonths(payRows,prev.length?prev:null);
 // 아직 끝나지 않은 달은 금액이 덜 쌓여 있어 '크게 바뀜'을 띄우지 않는다
 const ongoing=month>=today().slice(0,7);
 return out.map(c=>(c.flag==='신규'&&!pr?.locked)||(c.flag==='크게 바뀜'&&ongoing)?{...c,flag:null,...(c.flag==='신규'?{diff:0}:{})}:c);
}
export function CompareCell({c}:{c?:ReturnType<typeof compareMonths>[number]}){
 if(!c||c.prevNet===null&&c.flag!=='신규')return <span className="pc-none">—</span>;
 if(c.flag==='신규')return <span className="pc-flag">신규</span>;
 return <span className={'pc-diff'+(c.flag?' big':'')}>{signed(c.diff)}{c.pct!==null&&<small> ({c.pct>0?'+':''}{Math.round(c.pct*100)}%)</small>}{c.flag&&<b className="pc-flag"> 확인</b>}</span>;
}

export function PayrollClose({s,month,branch,run,payRows,compare,busy,mutate,update,demo}:{s:Team,month:string,branch:string,run:any,payRows:any[],compare:ReturnType<typeof compareMonths>,busy:boolean,mutate:(b:any)=>Promise<boolean>,update:(s:Team,close?:boolean)=>Promise<any>,demo:boolean}){
 const key=month+':'+branch,[date,setDate]=useState(today()),[bulk,setBulk]=useState(false);
 const gone=compare.filter(c=>c.flag==='이번 달 없음'),big=compare.filter(c=>c.flag==='크게 바뀜');
 const diff=run&&!run.locked?revisionDiff(run.prevRows,payRows):[];
 const sum=run?.locked?paidSummary(run):null;
 // 지시서 7주차: 확정 전 급여 정확도 점검
 const audit=run?.locked?[]:payAudit(s.employees.filter(e=>e.branchId===branch) as any,s.attendance as any,s.shifts,month,!!(s.settings as any).fivePlus);
 // 이력이 없던 예전 확정 건은 확정 정보로 한 줄 만든다
 const hist:any[]=run?.history?.length?run.history:run?.locked&&run.at?[{kind:'확정',revision:run.revision||1,at:run.at,by:run.actor?.name||'',total:run.rows.reduce((n:number,r:any)=>n+r.net,0)}]:[];
 return <div className="pay-close">
  {sum&&<section className="panel pc-paid" aria-label="지급 현황"><div className="panel-heading"><h2>지급 현황 · {sum.done}/{sum.total}명 지급 완료</h2></div>
   <div className="t-panelbody">{sum.left.length>0?<><p>아직 지급 완료로 표시하지 않은 직원 {sum.left.length}명 · {won(sum.amountLeft)}원</p>
    <div className="t-inline pc-paid-all"><label>지급한 날 <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button type="button" className="primary" disabled={busy} onClick={()=>mutate({action:'markPaid',key,ids:sum.left.map(r=>r.employeeId),date})}>남은 {sum.left.length}명 모두 지급 완료</button></div></>:<p className="pc-ok">✓ 모든 직원 지급 완료로 기록했어요.</p>}
    {sum.left.length>0&&(()=>{const b=bankTransferCsv(run.rows,s.employees as any,month,s.store.name,run.paid||{});return <div className="pc-bank"><button type="button" className="secondary" disabled={!b.count} onClick={()=>saveFile(`대량이체-${month}.csv`,b.csv,'text/csv;charset=utf-8')}>은행 대량이체 파일 ({b.count}명 · {won(b.total)}원)</button>{b.missing.length>0&&<small>계좌가 없어 빠진 직원: {b.missing.join(', ')} — 직원 관리에서 은행·계좌를 넣어 주세요.</small>}<small>인터넷뱅킹 '대량이체'에 올리는 파일이에요. 은행마다 양식이 조금 다르면 열 순서를 맞춰 주세요.</small></div>})()}
    <ul className="pc-paid-list">{run.rows.map((r:any)=>{const d=run.paid?.[r.employeeId];return <li key={r.employeeId}><span><b>{r.name}</b> {won(r.net)}원</span>{d?<><span className="pc-ok">✓ {md(d)} 지급</span><button type="button" className="secondary" disabled={busy} onClick={()=>mutate({action:'markPaid',key,ids:[r.employeeId],undo:true})}>취소</button></>:<button type="button" className="secondary" disabled={busy} onClick={()=>mutate({action:'markPaid',key,ids:[r.employeeId],date})}>지급 완료</button>}</li>})}</ul>
    <p className="footnote">실제 이체는 은행 앱에서 해 주세요. 여기서는 지급했다는 기록만 남기고, 직원 명세서 화면에도 '지급 완료'로 보여요.</p></div></section>}
  {!run?.locked&&<section className={'panel pc-audit'+(audit.length?'':' clean')} aria-label="급여 정확도 점검"><div className="panel-heading"><h2>급여 정확도 점검 {audit.length?`· ${audit.length}건`:''}</h2></div><div className="t-panelbody">{audit.length?<ul>{audit.map((f,i)=><li key={i}><span className={'pc-level '+(f.level==='확인 필요'?'need':'info')}>{f.level}</span> <b>{f.name}</b> {f.text}<small>{f.fix}</small></li>)}</ul>:<p className="pc-ok">✓ 확정 전에 확인할 기록·설정 문제가 없어요.</p>}</div></section>}
  {diff.length>0&&<section className="notice pc-rev" role="status"><b>지난 확정({run.revision||1}차)과 달라진 직원 {diff.length}명</b> 다시 확정하면 아래처럼 바뀌어요.<ul>{diff.map(d=><li key={d.employeeId}>{d.name}: {d.before===null?'새로 들어감':won(d.before)+'원'} → {d.after===null?'빠짐':won(d.after)+'원'} ({signed(d.diff)}{d.hours?`, 근무 ${d.hours>0?'+':''}${d.hours}시간`:''})</li>)}</ul></section>}
  {(gone.length>0||big.length>0)&&!run?.locked&&<section className="notice pc-cmp" role="note"><b>지난달과 비교해 확인할 직원</b><ul>{big.map(c=><li key={c.employeeId}>{c.name}: 실수령 {won(c.prevNet||0)}원 → {won(c.net||0)}원 ({signed(c.diff)}). 근무 기록과 수당·공제를 한 번 더 봐 주세요.</li>)}{gone.map(c=><li key={c.employeeId}>{c.name}: 지난달엔 있었는데 이번 달 급여가 없어요. 퇴사했거나 근무 기록이 빠졌는지 확인해 주세요.</li>)}</ul></section>}
  {!run?.locked&&<details className="pc-bulk" open={bulk} onToggle={e=>setBulk((e.target as HTMLDetailsElement).open)}><summary>여러 직원에게 같은 수당·공제 한꺼번에 넣기</summary>{bulk&&<BulkAdjust s={s} month={month} rows={payRows} busy={busy} update={update} demo={demo} done={()=>setBulk(false)}/>}</details>}
  {hist.length>0&&<details className="pc-history"><summary>확정 이력 {hist.length}건</summary><ol>{hist.map((h:any,i:number)=><li key={i}><b>{h.revision}차 {h.kind}</b> · {when(h.at)} · {h.by||'사장님'}{h.kind==='확정'?` · 실수령 합계 ${won(h.total)}원`:` · 사유: ${h.reason}`}</li>)}</ol></details>}
 </div>;
}

function BulkAdjust({s,month,rows,busy,update,done}:{s:Team,month:string,rows:any[],busy:boolean,update:(s:Team,close?:boolean)=>Promise<any>,demo:boolean,done:()=>void}){
 const [kind,setKind]=useState<'earnings'|'deductions'>('earnings'),[name,setName]=useState(''),[amount,setAmount]=useState(''),[formula,setFormula]=useState(''),[taxFree,setTaxFree]=useState(false),[ids,setIds]=useState<string[]>(rows.map(r=>r.employeeId)),[err,setErr]=useState('');
 const save=async()=>{const r=bulkAdjust(s.adjustments as any,month,ids,kind,{name,amount:Number(amount),formula:formula.trim()||'일괄 입력',...(kind==='earnings'&&taxFree?{taxFree:true}:{})});if(r.error){setErr(r.error);return}setErr('');if(await update({...s,adjustments:r.adjustments as any},false))done()};
 return <div className="pc-bulk-body">
  <div className="t-inline" role="group" aria-label="종류"><label><input type="radio" name="bk" checked={kind==='earnings'} onChange={()=>setKind('earnings')}/> 수당(더하기)</label><label><input type="radio" name="bk" checked={kind==='deductions'} onChange={()=>setKind('deductions')}/> 공제(빼기)</label></div>
  <div className="t-inline"><label>항목 이름 <input value={name} onChange={e=>setName(e.target.value)} placeholder="예: 명절 상여"/></label><label>금액(원) <input inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value.replace(/[^\d]/g,''))} placeholder="50000"/></label></div>
  <label>계산 근거 <input value={formula} onChange={e=>setFormula(e.target.value)} placeholder="예: 추석 상여 1인 정액"/></label>
  {kind==='earnings'&&<label className="t-check"><input type="checkbox" checked={taxFree} onChange={e=>setTaxFree(e.target.checked)}/> 비과세 항목(식대 등)</label>}
  <fieldset className="pc-bulk-who"><legend>넣을 직원 {ids.length}/{rows.length}명</legend><button type="button" className="link-btn" onClick={()=>setIds(ids.length===rows.length?[]:rows.map(r=>r.employeeId))}>{ids.length===rows.length?'모두 빼기':'모두 고르기'}</button>{rows.map(r=><label key={r.employeeId} className="t-check"><input type="checkbox" checked={ids.includes(r.employeeId)} onChange={e=>setIds(e.target.checked?[...ids,r.employeeId]:ids.filter(x=>x!==r.employeeId))}/> {r.name}</label>)}</fieldset>
  {err&&<p className="saas-error" role="alert">{err}</p>}
  <p className="footnote">같은 이름의 항목이 이미 있으면 금액을 새로 바꿔요. 직원마다 금액이 다르면 표의 '수당·공제'에서 따로 고쳐 주세요.</p>
  <button type="button" className="primary" disabled={busy} onClick={save}>{ids.length}명에게 넣기</button>
 </div>;
}

/** 지시서 115·116·120: 이번 달·다음 달 신고·납부 기한과 두루누리 지원 대상 */
export function FilingCalendar({s,month,branch,payRows}:{s:Team,month:string,branch:string,payRows:any[]}){
 const emps=s.employees.filter(e=>e.branchId===branch) as any[],y=Number(month.slice(0,4)),hol=new Set([...holidaysFor(y,true).keys(),...holidaysFor(y+1,true).keys()]);
 const nm=(()=>{const [a,b]=month.split('-').map(Number);return b===12?`${a+1}-01`:`${a}-${String(b+1).padStart(2,'0')}`})();
 const list=[...deadlinesFor(month,emps,hol),...deadlinesFor(nm,emps,hol)],td=today();
 const du=durunuriCandidates(emps,Object.fromEntries(payRows.map((r:any)=>[r.employeeId,r.gross])));
 return <section className="panel t-gap filing" aria-label="신고·납부 기한"><div className="panel-heading"><h2>신고·납부 기한</h2></div><div className="t-panelbody">
  {list.length?<ul>{list.map((x,i)=><li key={i} className={x.date<td?'past':''}><span className="fd">{Number(x.date.slice(5,7))}/{Number(x.date.slice(8))}{x.date<td?' (지남)':''}</span><span className={'pc-level '+(x.kind==='4대보험'?'info':'need')}>{x.kind}</span> <b>{x.title}</b><small>{x.detail}</small></li>)}</ul>:<p>이번 달·다음 달에 할 신고가 없어요.</p>}
  <p className="footnote">주말·공휴일이면 다음 영업일로 옮겼어요. 세무사에게 맡겼다면 세무사와 날짜를 확인해 주세요. 매일 아침 3일 전에 알림도 보내요.</p>
  {du.eligibleStore&&du.list.length>0&&<div className="notice"><b>두루누리 사회보험료 지원 대상일 수 있어요</b> · {du.list.map(e=>e.name).join(', ')} (월 보수 {won(DURUNURI_LIMIT)}원 미만, 근로자 10명 미만 사업장). 새로 가입한 직원은 고용보험·국민연금 보험료의 80%를 지원받을 수 있어요. 재산·소득 요건이 있으니 <a href="https://insurancesupport.or.kr" target="_blank" rel="noopener">두루누리 누리집</a>이나 공단(1355)에 확인해 주세요.</div>}
 </div></section>;
}
/** 지시서 105·106: 사장님 — 직원 명세서 문의·정보 변경 요청 처리 */
export function StaffAsksDesk({s,busy,mutate}:{s:Team,busy:boolean,mutate:(b:any)=>Promise<boolean>}){
 const open:any[]=((s as any).staffAsks||[]).filter((x:any)=>x.status==='확인 중'),[ans,setAns]=useState<Record<string,string>>({});
 if(!open.length)return null;
 const name=(id:string)=>s.employees.find(e=>e.id===id)?.name||'직원';
 const L:Record<string,string>={phone:'휴대폰',address:'주소',bankName:'은행',bankAccount:'계좌번호',bankHolder:'예금주',emergencyName:'비상연락처',emergencyPhone:'비상연락처 전화'};
 return <section className="panel t-gap asks-desk" aria-label="직원 문의·요청"><div className="panel-heading"><h2>직원 문의·요청 {open.length}건</h2></div><ul className="t-panelbody">{open.map(x=><li key={x.id}>
  <b>{name(x.employeeId)} · {x.type==='pay'?`${Number(x.month.slice(5))}월 명세서 '${x.item}' 문의`:x.type==='clock'?`인터넷 끊김 ${x.kind==='in'?'출근':'퇴근'} ${new Date(x.clockAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`:'내 정보 변경 요청'}</b>
  {x.message&&<p>{x.message}</p>}{x.changes&&<ul className="ask-changes">{Object.entries(x.changes).map(([k,v]:any)=><li key={k}>{L[k]||k}: <b>{v||'(비움)'}</b></li>)}</ul>}
  <label>답<input value={ans[x.id]||''} maxLength={1000} onChange={e=>setAns({...ans,[x.id]:e.target.value})} placeholder={x.type==='pay'?'예: 10/3 근무를 추가해 다시 확정할게요':'예: 바꿨어요'}/></label>
  <div className="actions">{x.type==='profile'||x.type==='clock'?<><button type="button" className="primary" disabled={busy} onClick={()=>mutate({action:'answerAsk',id:x.id,apply:true,answer:ans[x.id]||'바꿨어요'})}>그대로 반영</button><button type="button" className="secondary" disabled={busy||!ans[x.id]?.trim()} onClick={()=>mutate({action:'answerAsk',id:x.id,reject:true,answer:ans[x.id]})}>반려</button></>:<button type="button" className="primary" disabled={busy||!ans[x.id]?.trim()} onClick={()=>mutate({action:'answerAsk',id:x.id,answer:ans[x.id]})}>답 보내기</button>}</div>
 </li>)}</ul></section>;
}
