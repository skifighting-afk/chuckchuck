'use client';
import {L} from '../lib/staff-i18n';
// 지시서 3주차: 근무표 위에 붙는 작은 안내 — 022 시간대별 인원 부족·과잉, 023 직원에게 공개·확인 현황, 직원 '확인했어요'
import {useState} from 'react';
import {type Team,datePlus} from '../lib/team-model';
import {staffingGaps,weekStartOf} from '../lib/schedule-rules';
import {publishStatus,pendingAcks,pubKey,keyWeek} from '../lib/schedule-publish';

const md=(d:string)=>`${Number(d.slice(5,7))}/${Number(d.slice(8))}`;

/** 022: 일간 보기에서 그날 필요 인원과 비교(필요 인원은 '가능 시간으로 초안'에서 정해요) */
export function StaffingGaps(p:{s:Team,es:Team['employees'],date:string,branch:string,onSetup?:()=>void}){
 const br:any=p.s.branches.find(b=>b.id===p.branch),closed=br?.closedDays?.includes(new Date(p.date+'T00:00:00Z').getUTCDay());
 return <>{closed&&<p className="staff-gaps" role="note"><b>이날은 정기 휴무일이에요.</b> 근무를 넣으면 경고가 떠요. 영업하는 날이면 설정에서 휴무일을 바꿔 주세요.</p>}{br?.hours&&<p className="staff-hours">영업시간 {br.hours.open}–{br.hours.close}</p>}<GapsInner {...p}/></>;
}
function GapsInner({s,es,date,branch,onSetup}:{s:Team,es:Team['employees'],date:string,branch:string,onSetup?:()=>void}){
 const ids=new Set(es.map(e=>e.id)),needs=((s as any).staffingNeeds||[]).filter((n:any)=>!n.branchId||n.branchId===branch);
 if(!needs.length)return onSetup?<p className="staff-gaps-none">시간대별 필요 인원을 정해 두면 부족한 시간을 알려 드려요. <button type="button" className="link-btn" onClick={onSetup}>필요 인원 정하기</button></p>:null;
 const gaps=staffingGaps(date,s.shifts.filter(x=>ids.has(x.employeeId)),needs);
 if(!gaps.length)return <p className="staff-gaps ok" role="status">✓ 이날은 정해 둔 필요 인원을 모두 채웠어요.</p>;
 return <div className="staff-gaps" role="status"><b>이날 인원 확인</b><ul>{gaps.map((g,i)=><li key={i} className={g.kind==='부족'?'short':'over'}><span className="gap-kind">{g.kind==='부족'?'▼ 부족':'▲ 많음'}</span> {g.from}–{g.to} 필요 {g.need}명 · {g.kind==='부족'?`가장 적을 때 ${g.have}명`:`가장 많을 때 ${g.have}명`}</li>)}</ul>{onSetup&&<button type="button" className="link-btn" onClick={onSetup}>필요 인원 바꾸기</button>}</div>;
}

/** 023: 사장님 — 이 주 근무표를 직원에게 공개하고 누가 확인했는지 본다 */
export function PublishBar({s,es,date,branch,busy,save,linked=[],remind}:{s:Team,es:Team['employees'],date:string,branch:string,busy:boolean,save:(next:Team)=>Promise<any>,linked?:string[],remind?:(key:string)=>Promise<boolean>}){
 const ws=((s.settings as any).weekStart||'mon') as 'mon'|'sun',staff=es.filter(e=>e.status!=='퇴사');
 const st=publishStatus((s as any).publishedWeeks,branch,date,staff,ws),[open,setOpen]=useState(false),[confirm,setConfirm]=useState(false),[message,setMessage]=useState('');
 const has=s.shifts.some(x=>staff.some(e=>e.id===x.employeeId)&&x.date>=st.week&&x.date<=datePlus(st.week,6));
 const publish=async()=>{if(await save({...s,publishedWeeks:{...((s as any).publishedWeeks||{}),[st.key]:{at:new Date().toISOString(),acks:{}}}} as any)){setConfirm(false);setMessage('')}};
 const range=`${md(st.week)}~${md(datePlus(st.week,6))}`;
 const note=<small className="publish-visibility">저장한 근무는 직원 화면에 반영돼요. 공개는 알림과 확인을 요청하는 단계예요.</small>;
 if(!st.published)return <section className="publish-bar" aria-label="근무표 공개·확인"><p><span className="publish-state">알림 전</span> <b>{range} 근무표</b></p><p>직원에게 새 근무표 알림을 보내고 확인을 받아요.</p><button type="button" className="primary" disabled={busy||!has} onClick={publish}>{busy?'처리 중…':has?'직원에게 공개':'근무를 먼저 넣어 주세요'}</button>{note}</section>;
 const targets=st.pending.filter(e=>linked.includes(e.id)),unlinked=st.pending.filter(e=>!linked.includes(e.id));
 return <section className="publish-bar done" aria-label="근무표 공개·확인"><p><span className="publish-state">{st.changed?'공개 후 변경':'공개됨'}</span> <b>{range} 근무표</b> · 확인 {st.acked.length}/{st.acked.length+st.pending.length}명</p>
  <small>{(()=>{const t=Date.parse(st.at!);if(!Number.isFinite(t))return '공개 시각 확인 필요';const k=new Date(t+9*3600000).toISOString();return `${md(k.slice(0,10))} ${k.slice(11,16)} 공개`})()}{st.changed?' · 변경된 직원은 다시 확인해야 해요.':''}</small>
  <div className="publish-actions">{st.pending.length>0&&<button type="button" className="secondary" aria-expanded={open} onClick={()=>{setOpen(!open);setMessage('')}}>미확인 {st.pending.length}명 보기</button>}<button type="button" className="secondary" disabled={busy} aria-expanded={confirm} onClick={()=>setConfirm(!confirm)}>다시 공개·알림</button></div>
  {open&&<div className="publish-recipients"><h3>아직 확인하지 않은 직원</h3><ul>{st.pending.map(e=><li key={e.id}><b>{e.name}</b><span>{linked.includes(e.id)?'알림 요청 가능':'가입 연결 필요'}</span></li>)}</ul><p>재알림 대상 {targets.length}명 · 이미 확인한 {st.acked.length}명은 제외해요.{unlinked.length>0?` 가입 연결 전 ${unlinked.length}명은 앱 알림을 받을 수 없어요.`:''}</p><p>같은 직원에게 최근 1시간 안에 요청했다면 다시 보내지 않아요. 직원의 알림 설정에 따라 수신 여부가 달라요.</p>{remind&&<button type="button" className="primary" disabled={busy||!targets.length} onClick={async()=>{if(await remind(st.key))setMessage('미확인 직원 알림을 요청했어요. 수신·확인 완료를 뜻하지는 않아요.')}}>{busy?'처리 중…':'미확인 직원에게만 알림 요청'}</button>}{message&&<p role="status">{message}</p>}</div>}
  {confirm&&<div className="publish-confirm"><h3>전체 직원에게 다시 공개할까요?</h3><p>이 주의 모든 확인 기록 {st.acked.length}건을 초기화하고 매장 재직 직원 {staff.length}명에게 새 확인을 요청해요. 미확인 직원에게만 알리려면 위의 미확인 목록을 이용해 주세요.</p><div className="publish-actions"><button type="button" className="primary" disabled={busy} onClick={publish}>전체 확인 초기화·다시 공개</button><button type="button" className="secondary" disabled={busy} onClick={()=>setConfirm(false)}>취소</button></div></div>}{note}</section>;
}

/** 023: 직원 — 공개된 근무표 확인 */
export function StaffPublishAck({state,selfId,branchId,today,busy,mutate}:{state:Team,selfId:string,branchId:string,today:string,busy:boolean,mutate:(b:any)=>Promise<boolean>}){
 const ws=((state.settings as any).weekStart||'mon') as 'mon'|'sun';
 const keys=pendingAcks((state as any).publishedWeeks,selfId,branchId,today,ws);
 if(!keys.length)return null;
 return <div className="publish-ack" role="status">{keys.map(k=>{const w=keyWeek(k);return <div key={k}><p><b>{md(w)}~{md(datePlus(w,6))} 근무표가 공개됐어요</b> 내 근무 시간을 보고 확인을 눌러 주세요.</p><button type="button" className="btn primary" disabled={busy} onClick={()=>mutate({action:'ackWeek',key:k})}>{L('확인했어요')}</button></div>})}</div>;
}
export {pubKey,weekStartOf};

/** 지시서 5주차: 지점 영업시간·정기 휴무일·매장 전화(근무표에서 휴무일·영업시간 밖 근무를 알려 준다) */
const DAYS=['일','월','화','수','목','금','토'];
export function BranchHours({b,set}:{b:{hours?:{open:string,close:string},closedDays?:number[],phone?:string,geo?:any},set:(p:any)=>void}){
 const h=b.hours,closed=b.closedDays||[];
 return <div className="branch-hours">
  <fieldset><legend>영업시간</legend><label className="t-check"><input type="checkbox" checked={!!h} onChange={e=>set({hours:e.target.checked?{open:'10:00',close:'22:00'}:undefined})}/> 영업시간 정하기</label>{h&&<span className="t-inline"><label>여는 시간 <input type="time" value={h.open} onChange={e=>set({hours:{...h,open:e.target.value}})}/></label><label>닫는 시간 <input type="time" value={h.close} onChange={e=>set({hours:{...h,close:e.target.value}})}/></label></span>}</fieldset>
  <fieldset><legend>정기 휴무일</legend><span className="branch-days">{[1,2,3,4,5,6,0].map(d=><label key={d} className="t-check"><input type="checkbox" checked={closed.includes(d)} onChange={e=>set({closedDays:e.target.checked?[...closed,d].sort():closed.filter(x=>x!==d)})}/> {DAYS[d]}</label>)}</span></fieldset>
  <BranchGeo geo={b.geo} set={g=>set({geo:g})}/>
  <label className="branch-phone">매장 전화 <input inputMode="tel" value={b.phone||''} onChange={e=>set({phone:e.target.value.replace(/[^\d-]/g,'').slice(0,20)||undefined})} placeholder="02-123-4567"/></label>
 </div>;
}

/** 지시서 006: 출퇴근 위치 확인 — 매장에서 지금 위치를 저장하고 반경을 정한다(QR과 함께 써요) */
function BranchGeo({geo,set}:{geo?:{lat:number,lng:number,radius:number,mode:'warn'|'block'},set:(g:any)=>void}){
 const [msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 const here=async()=>{setBusy(true);setMsg('');const {currentPos}=await import('./att-device');const p=await currentPos();setBusy(false);if(!p){setMsg('위치를 받지 못했어요. 휴대폰 위치 권한을 켜고 매장 안에서 다시 눌러 주세요.');return}set({lat:Math.round(p.lat*1e6)/1e6,lng:Math.round(p.lng*1e6)/1e6,radius:geo?.radius||150,mode:geo?.mode||'warn'});setMsg(`지금 위치를 매장 위치로 정했어요(오차 약 ${p.acc}m). 아래 '저장'을 눌러야 반영돼요.`)};
 return <fieldset className="branch-geo"><legend>출근 위치 확인</legend>
  {geo?<><p className="footnote">매장 위치 저장됨 · 반경 안에서 찍었는지 함께 확인해요.</p>
   <span className="t-inline"><label>반경 <select value={geo.radius} onChange={e=>set({...geo,radius:Number(e.target.value)})}>{[50,100,150,300,500].map(r=><option key={r} value={r}>{r}m</option>)}</select></label>
   <label>반경 밖이면 <select value={geo.mode} onChange={e=>set({...geo,mode:e.target.value})}><option value="warn">기록하고 '위치 확인' 표시</option><option value="block">출근을 막기</option></select></label></span>
   <span className="t-inline"><button type="button" className="secondary" disabled={busy} onClick={here}>지금 위치로 다시 정하기</button><button type="button" className="secondary" onClick={()=>set(undefined)}>위치 확인 끄기</button></span></>
  :<><p className="footnote">매장 안에서 눌러 지금 위치를 저장하면, 직원이 출근할 때 매장 근처인지 확인해요. 위치는 출근 순간에만 확인하고 계속 따라다니지 않아요.</p><button type="button" className="secondary" disabled={busy} onClick={here}>{busy?'위치 받는 중…':'지금 위치를 매장 위치로'}</button></>}
  {msg&&<p role="status" className="footnote">{msg}</p>}</fieldset>;
}
