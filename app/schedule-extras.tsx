'use client';
// 지시서 3주차: 근무표 위에 붙는 작은 안내 — 022 시간대별 인원 부족·과잉, 023 직원에게 공개·확인 현황, 직원 '확인했어요'
import {useState} from 'react';
import {type Team,datePlus} from '../lib/team-model';
import {staffingGaps,weekStartOf} from '../lib/schedule-rules';
import {publishStatus,pendingAcks,pubKey,keyWeek} from '../lib/schedule-publish';

const md=(d:string)=>`${Number(d.slice(5,7))}/${Number(d.slice(8))}`;

/** 022: 일간 보기에서 그날 필요 인원과 비교(필요 인원은 '가능 시간으로 초안'에서 정해요) */
export function StaffingGaps({s,es,date,branch,onSetup}:{s:Team,es:Team['employees'],date:string,branch:string,onSetup?:()=>void}){
 const ids=new Set(es.map(e=>e.id)),needs=((s as any).staffingNeeds||[]).filter((n:any)=>!n.branchId||n.branchId===branch);
 if(!needs.length)return onSetup?<p className="staff-gaps-none">시간대별 필요 인원을 정해 두면 부족한 시간을 알려 드려요. <button type="button" className="link-btn" onClick={onSetup}>필요 인원 정하기</button></p>:null;
 const gaps=staffingGaps(date,s.shifts.filter(x=>ids.has(x.employeeId)),needs);
 if(!gaps.length)return <p className="staff-gaps ok" role="status">✓ 이날은 정해 둔 필요 인원을 모두 채웠어요.</p>;
 return <div className="staff-gaps" role="status"><b>이날 인원 확인</b><ul>{gaps.map((g,i)=><li key={i} className={g.kind==='부족'?'short':'over'}><span className="gap-kind">{g.kind==='부족'?'▼ 부족':'▲ 많음'}</span> {g.from}–{g.to} 필요 {g.need}명 · {g.kind==='부족'?`가장 적을 때 ${g.have}명`:`가장 많을 때 ${g.have}명`}</li>)}</ul>{onSetup&&<button type="button" className="link-btn" onClick={onSetup}>필요 인원 바꾸기</button>}</div>;
}

/** 023: 사장님 — 이 주 근무표를 직원에게 공개하고 누가 확인했는지 본다 */
export function PublishBar({s,es,date,branch,busy,save}:{s:Team,es:Team['employees'],date:string,branch:string,busy:boolean,save:(next:Team)=>Promise<any>}){
 const ws=((s.settings as any).weekStart||'mon') as 'mon'|'sun',staff=es.filter(e=>e.status!=='퇴사');
 const st=publishStatus((s as any).publishedWeeks,branch,date,staff,ws),[open,setOpen]=useState(false);
 const has=s.shifts.some(x=>staff.some(e=>e.id===x.employeeId)&&x.date>=st.week&&x.date<=datePlus(st.week,6));
 const publish=()=>save({...s,publishedWeeks:{...((s as any).publishedWeeks||{}),[st.key]:{at:new Date().toISOString(),acks:{}}}} as any);
 const range=`${md(st.week)}~${md(datePlus(st.week,6))}`;
 if(!st.published)return <div className="publish-bar"><p><b>{range} 근무표</b> · 아직 직원에게 공개 전이에요. 공개하면 직원에게 알림이 가고, 직원이 확인했는지 볼 수 있어요.</p><button type="button" className="primary" disabled={busy||!has} onClick={publish}>{has?'직원에게 공개':'근무를 먼저 넣어 주세요'}</button></div>;
 return <div className="publish-bar done"><p><b>{range} 근무표 공개됨</b> · {(()=>{const k=new Date(Date.parse(st.at!)+9*3600000).toISOString();return `${md(k.slice(0,10))} ${k.slice(11,16)} 공개`})()} · 확인 {st.acked.length}/{st.acked.length+st.pending.length}명</p>
  <div className="publish-actions">{st.pending.length>0&&<button type="button" className="secondary" aria-expanded={open} onClick={()=>setOpen(!open)}>미확인 {st.pending.length}명 보기</button>}<button type="button" className="secondary" disabled={busy} onClick={publish} title="바뀐 내용을 다시 알리고 확인을 새로 받아요">다시 공개·알림</button></div>
  {open&&<p className="publish-pending">아직 확인 안 함: {st.pending.map(e=>e.name).join(', ')}</p>}
  <small>공개 뒤 근무를 바꾸면 그 직원에게 알림이 가고, 그 직원은 다시 확인해야 해요.</small></div>;
}

/** 023: 직원 — 공개된 근무표 확인 */
export function StaffPublishAck({state,selfId,branchId,today,busy,mutate}:{state:Team,selfId:string,branchId:string,today:string,busy:boolean,mutate:(b:any)=>Promise<boolean>}){
 const ws=((state.settings as any).weekStart||'mon') as 'mon'|'sun';
 const keys=pendingAcks((state as any).publishedWeeks,selfId,branchId,today,ws);
 if(!keys.length)return null;
 return <div className="publish-ack" role="status">{keys.map(k=>{const w=keyWeek(k);return <div key={k}><p><b>{md(w)}~{md(datePlus(w,6))} 근무표가 공개됐어요</b> 내 근무 시간을 보고 확인을 눌러 주세요.</p><button type="button" className="btn primary" disabled={busy} onClick={()=>mutate({action:'ackWeek',key:k})}>확인했어요</button></div>})}</div>;
}
export {pubKey,weekStartOf};
