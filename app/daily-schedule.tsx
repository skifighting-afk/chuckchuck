'use client';
// 근무 스케줄 일간 보기. 막대를 누르면 수정, 끌면(휴대폰은 꾹 누른 뒤) 시간·직원 바꾸기(지시서 3주차 021).
// '복사' 켜거나 Alt·Ctrl을 누른 채 끌면 복사. 15분 단위로 맞춘다. 막히면 이유를 보여 주고 저장하지 않는다.
import {useRef,useState} from 'react';
import {type Team,datePlus} from '../lib/team-model';
import {editBlockReason} from '../lib/schedule-move';
import {checkShift} from '../lib/schedule-rules';

const minutes=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3));
const hm=(m:number)=>{m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
type Shift=Team['shifts'][number];
export function DailySchedule({state,employees,date,onEdit,onSave}:{state:Team,employees:Team['employees'],date:string,onEdit:(shift:Shift)=>void,onSave?:(shifts:Team['shifts'])=>Promise<boolean>}){
 const rows=employees.map(employee=>({employee,segments:state.shifts.filter(s=>s.employeeId===employee.id).flatMap(shift=>{
  const start=minutes(shift.start),end=minutes(shift.end),overnight=end<start;
  if(shift.date===date)return [{shift,start,end:overnight?1440:end,continued:false,overnight}];
  if(overnight&&shift.date===datePlus(date,-1)&&end>0)return [{shift,start:0,end,continued:true,overnight}];
  return [];
 }).sort((a,b)=>a.start-b.start)}));
 const [copy,setCopy]=useState(false),[drag,setDrag]=useState<{id:string,x:number,y:number,label:string,why:string|null}|null>(null),[msg,setMsg]=useState(''),[undo,setUndo]=useState<{shifts:Team['shifts'],text:string}|null>(null);
 const suppress=useRef(false),ut=useRef<any>(null),canMove=!!onSave;
 const name=(id:string)=>employees.find(e=>e.id===id)?.name||'';
 // 지시서 3주차 025: 승인된 휴가인 직원은 빈 줄 대신 '휴가'
 const onLeave=(id:string)=>((state as any).approvedLeaves||[]).some((l:any)=>l.employeeId===id&&l.start<=date&&date<=l.end);
 // 끌어 놓은 결과(새 근무)와 막힌 이유
 function plan(sh:Shift,dx:number,trackW:number,targetEmp:string|null,isCopy:boolean){
  const d=Math.round(dx/trackW*1440/15)*15,len=(minutes(sh.end)-minutes(sh.start)+1440)%1440||1440;
  const st=Math.max(0,Math.min(1440-15,minutes(sh.start)+d));
  const cand={...sh,id:isCopy?'copy':sh.id,employeeId:targetEmp||sh.employeeId,start:hm(st),end:hm(st+len)};
  const why=editBlockReason(state,cand,isCopy?undefined:sh.id)||checkShift(cand,state.shifts.filter(x=>isCopy||x.id!==sh.id),employees.find(e=>e.id===cand.employeeId) as any,((state.settings as any).weekStart||'mon')).find(c=>c.level==='block')?.text||null;
  return {cand,why,changed:cand.start!==sh.start||cand.employeeId!==sh.employeeId};
 }
 function down(e:React.PointerEvent<HTMLButtonElement>,sh:Shift){
  if(!canMove||e.button!==0)return;suppress.current=false;
  const track=(e.currentTarget.closest('.daily-tracks') as HTMLElement),w=track.getBoundingClientRect().width,x0=e.clientX,y0=e.clientY,type=e.pointerType;let active=false,timer:any=null;
  const empAt=(x:number,y:number)=>{for(const el of document.elementsFromPoint(x,y)){const r=(el as HTMLElement).closest?.('[data-emp]');if(r)return r.getAttribute('data-emp')}return null};
  const show=(x:number,y:number,ev?:PointerEvent)=>{const p=plan(sh,x-x0,w,empAt(x,y),copy||!!ev?.altKey||!!ev?.ctrlKey);setDrag({id:sh.id,x,y,label:`${name(p.cand.employeeId)} ${p.cand.start}–${p.cand.end}${copy||ev?.altKey||ev?.ctrlKey?' (복사)':''}`,why:p.why})};
  const start=(x:number,y:number)=>{active=true;suppress.current=true;document.body.classList.add('ms-dragging');show(x,y)};
  if(type!=='mouse')timer=setTimeout(()=>start(x0,y0),400);
  const stop=(ev:TouchEvent)=>{if(active)ev.preventDefault()};document.addEventListener('touchmove',stop,{passive:false});
  const mv=(ev:PointerEvent)=>{if(!active){const far=Math.hypot(ev.clientX-x0,ev.clientY-y0);if(type==='mouse'&&far>5)start(ev.clientX,ev.clientY);else if(type!=='mouse'&&far>8){clearTimeout(timer);end()}return}show(ev.clientX,ev.clientY,ev)};
  const up=async(ev:PointerEvent)=>{clearTimeout(timer);const was=active;end();if(!was||ev.type!=='pointerup')return;setTimeout(()=>{suppress.current=false},60);
   const isCopy=copy||ev.altKey||ev.ctrlKey,p=plan(sh,ev.clientX-x0,w,empAt(ev.clientX,ev.clientY),isCopy);
   if(!p.changed&&!isCopy)return;if(p.why){setMsg(p.why);return}
   const before=state.shifts,next=isCopy?[...before,{...p.cand,id:crypto.randomUUID()}]:before.map(x=>x.id===sh.id?p.cand:x);
   if(await onSave!(next)){const text=`${name(p.cand.employeeId)} ${p.cand.start}–${p.cand.end}${isCopy?'로 복사했어요':'로 옮겼어요'}`;setMsg(text);clearTimeout(ut.current);setUndo({shifts:before,text});ut.current=setTimeout(()=>setUndo(null),5000)}};
  const end=()=>{active=false;setDrag(null);document.body.classList.remove('ms-dragging');document.removeEventListener('touchmove',stop);removeEventListener('pointermove',mv);removeEventListener('pointerup',up);removeEventListener('pointercancel',up)};
  addEventListener('pointermove',mv);addEventListener('pointerup',up);addEventListener('pointercancel',up);
 }
 return <><div className="simple-instruction"><b>오늘 누가, 몇 시에 일하나요?</b><p>{date} · 근무 예정 직원 {rows.filter(r=>r.segments.length).length}명. 막대를 누르면 근무 시간을 수정할 수 있어요.{canMove?' 끌면 시간·직원을 바꿔요(휴대폰은 꾹 누른 뒤).':''}</p></div>
  {canMove&&<div className="daily-tools"><label className="daily-copy"><input type="checkbox" checked={copy} onChange={e=>setCopy(e.target.checked)}/> 끌어서 복사하기</label><small>PC는 Alt·Ctrl을 누른 채 끌어도 복사돼요. 15분 단위로 맞춰요.</small></div>}
  <p className="table-scroll-help" id="daily-help">왼쪽은 직원, 위쪽은 시간이에요. 표가 잘리면 옆으로 밀어 보세요. 휴게시간의 위치는 표시하지 않아요.</p><div className="t-tablewrap" tabIndex={0} role="region" aria-label="일간 근무 시간표" aria-describedby="daily-help"><div className="daily-grid"><div className="daily-row daily-head"><strong>직원 / 업무</strong><div className="daily-hours">{Array.from({length:24},(_,h)=><span key={h}>{String(h).padStart(2,'0')}시</span>)}<span className="daily-end">24시</span></div></div>{rows.map(({employee,segments})=><div className="daily-row" key={employee.id} data-emp={employee.id}><div className="daily-person"><b>{employee.name}</b><small>{employee.role}</small></div><div className="daily-tracks" style={{height:Math.max(1,segments.length)*64+16}}>{segments.length===0?<span className={'daily-empty'+(onLeave(employee.id)?' leave':'')}>{onLeave(employee.id)?'휴가 (승인됨)':'등록된 근무 없음'}</span>:segments.map((seg,i)=><button key={seg.shift.id} className={'daily-bar'+(drag?.id===seg.shift.id?' lifting':'')} style={{left:`${seg.start/14.4}%`,width:`${Math.max(seg.end-seg.start,1)/14.4}%`,top:8+i*64}} onPointerDown={e=>{if(!seg.continued)down(e,seg.shift)}} onContextMenu={e=>{if(canMove)e.preventDefault()}} onClick={()=>{if(suppress.current){suppress.current=false;return}onEdit(seg.shift)}}><span className="sr-only">{employee.name} {seg.shift.date} </span><span>{seg.continued?'전날부터 → ':''}{seg.shift.start}–{seg.overnight?'다음 날 ':''}{seg.shift.end}</span><small> 휴게 {seg.shift.breakMinutes}분</small><span className="sr-only"> 수정</span></button>)}</div></div>)}</div></div>
  {drag&&<div className={'month-ghost'+(drag.why?' no':'')} style={{left:drag.x,top:drag.y}} aria-hidden="true">{drag.label}{drag.why&&<small>{drag.why}</small>}</div>}
  <p className="sr-only" role="status" aria-live="polite">{msg}</p>{msg&&!undo&&!drag&&<p className="month-msg" aria-hidden="true">{msg}</p>}
  {undo&&<div className={'month-undo'+(drag?' dim':'')} role="status"><span>{undo.text}</span><button type="button" onClick={async()=>{const u=undo;setUndo(null);clearTimeout(ut.current);if(await onSave!(u.shifts))setMsg('되돌렸어요.')}}>되돌리기</button></div>}
  <div className="daily-list"><h2>오늘 근무 시간 한 번 더 보기</h2>{rows.filter(r=>r.segments.length).map(({employee,segments})=><div key={employee.id}><b>{employee.name}</b>{segments.map(seg=><button key={seg.shift.id} onClick={()=>onEdit(seg.shift)}>{seg.continued?'전날 ':''}{seg.shift.start} → {seg.overnight&&!seg.continued?'다음 날 ':''}{seg.shift.end} · 휴게 {seg.shift.breakMinutes}분 · 수정</button>)}</div>)}{!rows.some(r=>r.segments.length)&&<p>등록된 근무가 없어요. 위의 ‘근무 추가’를 눌러 주세요.</p>}</div></>;
}
