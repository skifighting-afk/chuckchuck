'use client';
// 지시서 8주차: 직원 화면 — 이번 주 주휴 조건 진행, 이번 달 예상 급여, 내 근무 달력, 증명서 요청
import {useState,useEffect} from 'react';
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
  <div className="my-cal-grid">{WD.map(w=><span key={w} className="my-cal-h" aria-hidden="true">{w}</span>)}{Array.from({length:c.lead},(_,i)=><span key={'x'+i}/>)}{c.days.map(d=><button type="button" key={d.date} className={'my-cal-d'+(d.state?' s-'+({'근무함':'ok','근무 중':'now','퇴근 기록 없음':'warn','기록 없음':'miss','예정':'plan'} as any)[d.state]:'')+(d.date===today()?' today':'')+(pick===d.date?' on':'')} onClick={()=>setPick(pick===d.date?'':d.date)}><span className="n">{Number(d.date.slice(8))}</span>{d.hours>0?<span className="h">{d.hours}h</span>:d.state==='예정'?<span className="h">예정</span>:d.state==='기록 없음'?<span className="h">없음</span>:null}<span className="sr-only"> {Number(d.date.slice(5,7))}월 {WD[d.dow]}요일 {d.state||'근무 없음'}</span></button>)}</div>
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
/** 지시서 104: 사장님이 발급한 내 증명서 꺼내 보기 */
export function MyCertificates({state}:{state:Team}){
 const list:any[]=[...((state as any).certificates||[])].reverse();
 if(!list.length)return null;
 const save=(c:any)=>{const url=URL.createObjectURL(new Blob([c.text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`${c.kind}증명서-${c.issuedAt.slice(0,10)}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 return <section className="panel t-gap my-certs" aria-label="내 증명서"><div className="panel-heading"><h2>내 증명서</h2></div><ul className="t-panelbody">{list.map(c=><li key={c.id}><details><summary>{c.kind}증명서 · {c.issuedAt.slice(0,10)} 발급</summary><pre>{c.text}</pre><button type="button" className="secondary" onClick={()=>save(c)}>파일로 받기</button></details></li>)}</ul></section>;
}
/** 지시서 105: 명세서 이의 신청(직원) */
export function PayQuestion({state,selfId,month,items,busy,mutate}:{state:Team,selfId:string,month:string,items:string[],busy:boolean,mutate:(b:any)=>Promise<boolean>}){
 const mine=((state as any).staffAsks||[]).filter((x:any)=>x.type==='pay'&&x.month===month),[open,setOpen]=useState(false),[item,setItem]=useState(items[0]||'기타'),[msg,setMsg]=useState('');
 return <section className="panel t-gap pay-q" aria-label="명세서 문의"><div className="t-panelbody">
  {mine.map((x:any)=><div key={x.id} className="ask-item"><b>{x.item||'명세서'} 문의 · {x.status}</b><p>{x.message}</p>{x.answer&&<p className="ask-answer"><b>사장님 답</b> {x.answer}</p>}</div>)}
  {!open?<button type="button" className="secondary" onClick={()=>setOpen(true)}>이 명세서에 이상한 항목이 있어요</button>:<form onSubmit={async e=>{e.preventDefault();if(await mutate({action:'staffAsk',type:'pay',month,item,message:msg})){setOpen(false);setMsg('')}}}>
   <label>어떤 항목인가요 <select value={item} onChange={e=>setItem(e.target.value)}>{[...items,'근무 시간','기타'].map(i=><option key={i}>{i}</option>)}</select></label>
   <label>무엇이 이상한가요 <textarea rows={3} maxLength={1000} required value={msg} onChange={e=>setMsg(e.target.value)} placeholder="예: 10월 3일 근무가 빠진 것 같아요"/></label>
   <div className="actions"><button type="button" className="secondary" onClick={()=>setOpen(false)}>그만두기</button><button className="primary" disabled={busy||!msg.trim()}>사장님께 보내기</button></div></form>}
 </div></section>;
}
/** 지시서 106: 내 정보 변경 요청(직원) */
export function ProfileRequest({state,selfId,busy,mutate}:{state:Team,selfId:string,busy:boolean,mutate:(b:any)=>Promise<boolean>}){
 const me:any=state.employees.find(e=>e.id===selfId)||{},asks=((state as any).staffAsks||[]).filter((x:any)=>x.type==='profile').slice(-3).reverse();
 const F:[string,string][]=[['phone','휴대폰'],['address','주소'],['bankName','급여 받을 은행'],['bankAccount','계좌번호'],['bankHolder','예금주'],['emergencyName','비상연락처 이름(관계)'],['emergencyPhone','비상연락처 전화']];
 const [v,setV]=useState<Record<string,string>>({}),[open,setOpen]=useState(false);
 return <section className="panel t-gap" aria-label="내 정보 변경 요청"><div className="panel-heading"><h2>내 정보 바꾸기</h2></div><div className="t-panelbody">
  {asks.map((x:any)=><div key={x.id} className="ask-item"><b>{Object.keys(x.changes||{}).map(k=>F.find(f=>f[0]===k)?.[1]||k).join('·')} 변경 · {x.status}</b>{x.answer&&<p className="ask-answer"><b>사장님 답</b> {x.answer}</p>}</div>)}
  {!open?<button type="button" className="secondary" onClick={()=>{setOpen(true);setV(Object.fromEntries(F.map(([k])=>[k,me[k]||''])))}}>연락처·계좌 변경 요청</button>:<form className="pr-form" onSubmit={async e=>{e.preventDefault();if(await mutate({action:'staffAsk',type:'profile',changes:v,message:''}))setOpen(false)}}>
   {F.map(([k,l])=><label key={k}>{l}<input value={v[k]||''} maxLength={k==='address'?300:60} inputMode={/Phone|phone|Account/.test(k)?'tel':undefined} onChange={e=>setV({...v,[k]:e.target.value})}/></label>)}
   <p className="footnote">사장님이 확인하면 바뀌어요. 계좌는 급여 이체에 써요.</p>
   <div className="actions"><button type="button" className="secondary" onClick={()=>setOpen(false)}>그만두기</button><button className="primary" disabled={busy}>요청 보내기</button></div></form>}
 </div></section>;
}
/** 지시서 110: 고정한 중요 공지를 직원 첫 화면 맨 위에 */
export function PinnedNotices({demo}:{demo:boolean}){
 const [list,setList]=useState<any[]>([]);
 useEffect(()=>{if(demo)return;let alive=true;fetch('/api/operations').then(r=>r.ok?r.json():null).then((d:any)=>{if(alive&&d)setList((d.notices||[]).filter((n:any)=>n.pinned))}).catch(()=>{});return()=>{alive=false}},[demo]);
 if(!list.length)return null;
 return <section className="pinned-notices" aria-label="중요 공지">{list.slice(0,3).map(n=><article key={n.id}><b>📌 {n.title}</b><p>{n.body}</p></article>)}</section>;
}
