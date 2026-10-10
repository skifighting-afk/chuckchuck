'use client';
// 작업 050: 직원이 낸 근무 가능 시간 + 사장님이 정한 필요 인원으로 근무표 초안
import {useEffect,useState} from 'react';
import {Field,Btn} from './team-ui';
import {type Team,type Member,datePlus} from '../lib/team-model';
import {draftFromAvailability,type Need,type Slot} from '../lib/schedule-tools';
export const WEEKDAYS=['일','월','화','수','목','금','토'];
const ORDER=[1,2,3,4,5,6,0];
export function ScheduleDraft({s,es,branch,week,busy,update,done}:{s:Team,es:Member[],branch:string,week:string,busy:boolean,update:(s:Team,close?:boolean)=>Promise<any>,done:(msg:string)=>void}){
 const [avail,setAvail]=useState<Record<string,{slots:Slot[],note:string,updatedAt:string}>|null>(null),[err,setErr]=useState('');
 const all:any[]=(s as any).staffingNeeds||[],[rows,setRows]=useState<Need[]>(all.filter(n=>!n.branchId||n.branchId===branch).map(({branchId,...n})=>n));
 useEffect(()=>{fetch('/api/operations').then(r=>r.json().then(d=>{if(!r.ok)throw Error((d as any).error);setAvail((d as any).availability||{})})).catch(e=>setErr(e.message||'근무 가능 시간을 불러오지 못했어요. 다시 열어 주세요.'))},[]);
 const staff=es.filter(e=>e.status!=='퇴사'),ids=new Set(staff.map(e=>e.id));
 const leaves=((s as any).approvedLeaves||[]).filter((l:any)=>ids.has(l.employeeId));
 const valid=rows.every(r=>/^\d\d:\d\d$/.test(r.start)&&/^\d\d:\d\d$/.test(r.end)&&r.start!==r.end&&r.count>=1);
 const plan=avail&&valid?draftFromAvailability(rows,Object.fromEntries(Object.entries(avail).map(([k,v])=>[k,v.slots])),week,s.shifts.filter(x=>ids.has(x.employeeId)),staff.map(e=>({id:e.id,weeklyHours:e.weeklyHours})),leaves):null;
 const [due,setDue]=useState<number|undefined>((s.settings as any).availabilityDue);
 const set=(i:number,p:Partial<Need>)=>setRows(rows.map((r,j)=>j===i?{...r,...p}:r));
 const keep=()=>[...all.filter(n=>n.branchId&&n.branchId!==branch),...rows.map(r=>({...r,branchId:branch}))];
 const submitted=staff.filter(e=>avail?.[e.id]?.slots?.length);
 return <>
  <p>직원이 앱에서 낸 근무 가능 시간과 아래 필요 인원으로 {week} ~ {datePlus(week,6)} 근무표 초안을 만들어요. 이번 주 근무가 적은 직원부터, 주 소정근로시간을 넘기지 않게 배정해요. 승인된 휴가와 겹치는 근무는 피해요.</p>
  {err&&<p className="saas-error" role="alert">{err}</p>}
  <section className="draft-avail"><h3>근무 가능 시간 낸 직원 {avail?`${submitted.length}/${staff.length}명`:'…'}</h3>{avail&&<ul>{staff.map(e=>{const a=avail[e.id];return <li key={e.id}><b>{e.name}</b> {a?.slots?.length?ORDER.flatMap(d=>a.slots.filter(x=>x.weekday===d).map(x=>`${WEEKDAYS[d]} ${x.start}~${x.end}`)).join(', '):<span className="t-muted">아직 안 냄</span>}{a?.note&&<small> · {a.note}</small>}</li>})}</ul>}</section>
  <div className="t-inline draft-due"><Field label="근무 가능 시간 마감 요일(그날 오전 10시에 안 낸 직원에게 알림)"><select value={due??''} onChange={e=>setDue(e.target.value===''?undefined:Number(e.target.value))}><option value="">알림 안 보냄</option>{ORDER.map(d=><option key={d} value={d}>매주 {WEEKDAYS[d]}요일</option>)}</select></Field><Btn disabled={busy||due===(s.settings as any).availabilityDue} onClick={async()=>{if(await update({...s,settings:{...s.settings,availabilityDue:due}} as any,false))done(due===undefined?'마감 알림을 껐어요.':`매주 ${WEEKDAYS[due]}요일 오전 10시에 아직 안 낸 직원에게 알려요.`)}}>마감 요일 저장</Btn></div>
  <h3>요일별 필요 인원</h3>
  {rows.map((r,i)=><div className="t-inline draft-need" key={i}><Field label="요일"><select value={r.weekday} onChange={e=>set(i,{weekday:Number(e.target.value)})}>{ORDER.map(d=><option key={d} value={d}>{WEEKDAYS[d]}</option>)}</select></Field><Field label="시작"><input type="time" value={r.start} onChange={e=>set(i,{start:e.target.value})}/></Field><Field label="끝"><input type="time" value={r.end} onChange={e=>set(i,{end:e.target.value})}/></Field><Field label="인원"><input type="number" min={1} max={20} value={r.count} onChange={e=>set(i,{count:Math.max(1,Math.min(20,Number(e.target.value)||1))})}/></Field><Field label="휴게(분)"><input type="number" min={0} max={720} value={r.breakMinutes} onChange={e=>set(i,{breakMinutes:Math.max(0,Math.min(720,Number(e.target.value)||0))})}/></Field><Btn onClick={()=>setRows(rows.filter((_,j)=>j!==i))}>삭제</Btn></div>)}
  <div className="actions"><Btn disabled={rows.length>=60} onClick={()=>setRows([...rows,{weekday:1,start:'09:00',end:'15:00',count:1,breakMinutes:30}])}>필요 시간 추가</Btn><Btn disabled={rows.length>=60||!rows.length} onClick={()=>{const last=rows[rows.length-1];setRows([...rows,...ORDER.filter(d=>d!==last.weekday&&!rows.some(r=>r.weekday===d&&r.start===last.start)).map(d=>({...last,weekday:d}))])}}>마지막 줄을 매일로</Btn><Btn disabled={busy||!valid} onClick={async()=>{if(await update({...s,staffingNeeds:keep()} as any,false))done('필요 인원을 저장했어요.')}}>필요 인원만 저장</Btn></div>
  {plan&&<div className="notice" role="status"><p><b>초안 {plan.made.length}개</b>{plan.unfilled.length>0&&<> · 못 채운 자리 {plan.unfilled.reduce((n,u)=>n+u.missing,0)}명</>}</p>{plan.made.length>0&&<ul>{plan.made.slice(0,40).map(x=><li key={x.id}>{x.date} ({WEEKDAYS[new Date(x.date+'T00:00:00Z').getUTCDay()]}) {x.start}~{x.end} · {staff.find(e=>e.id===x.employeeId)?.name}</li>)}</ul>}{plan.unfilled.length>0&&<p className="footnote">못 채운 자리: {plan.unfilled.map(u=>`${u.date} ${u.start}~${u.end} ${u.missing}명`).join(', ')} — 직원에게 가능 시간을 더 내 달라고 하거나 직접 넣어 주세요.</p>}</div>}
  <Btn primary disabled={busy||!plan?.made.length} onClick={async()=>{if(plan&&await update({...s,staffingNeeds:keep(),shifts:[...s.shifts,...plan.made]} as any))done(`근무표 초안 ${plan.made.length}개를 넣었어요. 근무표에서 고치거나 지울 수 있어요.`)}}>초안을 근무표에 넣기</Btn>
 </>
}
/** 직원: 내 근무 가능 시간 내기 */
export function MyAvailability({current,busy,save}:{current?:{slots:Slot[],note:string,updatedAt:string},busy:boolean,save:(slots:Slot[],note:string)=>void}){
 const init=Object.fromEntries(ORDER.map(d=>{const x=current?.slots.find(s=>s.weekday===d);return [d,{on:!!x,start:x?.start||'09:00',end:x?.end||'18:00'}]}));
 const [days,setDays]=useState<Record<number,{on:boolean,start:string,end:string}>>(init as any),[note,setNote]=useState(current?.note||'');
 const set=(d:number,p:any)=>setDays({...days,[d]:{...days[d],...p}});
 return <section className="panel t-gap"><div className="panel-heading"><h2>내 근무 가능 시간</h2>{current?.updatedAt&&<small>{new Date(current.updatedAt).toLocaleDateString('ko-KR')} 제출</small>}{current?.slots?.length?<button type="button" className="secondary" disabled={busy} onClick={()=>save(current.slots,current.note||'')} title="지난번에 낸 시간 그대로 이번 주에도 내기">지난번 그대로 내기</button>:null}</div><div className="t-panelbody"><p className="footnote">일할 수 있는 요일과 시간을 내면 사장님이 근무표를 짤 때 참고해요.</p>{ORDER.map(d=><div className="t-inline avail-row" key={d}><label className="t-check"><input type="checkbox" checked={days[d].on} onChange={e=>set(d,{on:e.target.checked})}/> {WEEKDAYS[d]}요일</label>{days[d].on&&<><input aria-label={WEEKDAYS[d]+'요일 시작'} type="time" value={days[d].start} onChange={e=>set(d,{start:e.target.value})}/>~<input aria-label={WEEKDAYS[d]+'요일 끝'} type="time" value={days[d].end} onChange={e=>set(d,{end:e.target.value})}/></>}</div>)}<Field label="메모 (선택)"><input maxLength={300} value={note} placeholder="예: 시험 기간에는 주말만 가능" onChange={e=>setNote(e.target.value)}/></Field><Btn primary disabled={busy} onClick={()=>save(ORDER.filter(d=>days[d].on).map(d=>({weekday:d,start:days[d].start,end:days[d].end})),note)}>가능 시간 내기</Btn></div></section>
}
