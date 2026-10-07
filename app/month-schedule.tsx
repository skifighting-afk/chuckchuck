// 근무표 한 달 보기: 달력 칸마다 그날 근무 막대. 막대를 꾹 눌러(PC는 바로) 다른 날로 끌어 옮긴다(지시서 1라운드 B).
// 짧게 누르면 그날 일간 근무표로. 휴대폰은 날짜를 누르면 그날 근무 목록을 달력 아래에 펼치고, 그 목록에서 끈다.
// 키보드: 막대에서 Space로 잡고, 방향키로 옮기고, Space로 놓기. Esc는 취소.
'use client';
import {empColor} from '../lib/schedule-bulk';
import {useEffect,useMemo,useRef,useState} from 'react';
import {type Team} from '../lib/team-model';
import {PUBLIC_HOLIDAYS} from '../lib/holidays';
import {moveShift,moveBlockReason,moveMessage,dayLabel} from '../lib/schedule-move';

const iso=(d:Date)=>d.toISOString().slice(0,10);
const plus=(d:string,n:number)=>iso(new Date(Date.parse(d+'T00:00:00Z')+n*86400000));
export function monthGrid(anchor:string,weekStart:'mon'|'sun'='mon'){
 const first=new Date(anchor.slice(0,7)+'-01T00:00:00Z'),offset=weekStart==='mon'?(first.getUTCDay()+6)%7:first.getUTCDay();
 const start=new Date(first.getTime()-offset*86400000),days:string[]=[];
 for(let i=0;i<42;i++){const d=iso(new Date(start.getTime()+i*86400000));if(i>=35&&d.slice(0,7)!==anchor.slice(0,7))break;days.push(d)}
 return days;
}
const monthShift=(anchor:string,n:number)=>{const y=Number(anchor.slice(0,4)),m=Number(anchor.slice(5,7))-1+n;return iso(new Date(Date.UTC(y,m,1)))};
type Drag={id:string,from:string,over:string|null,x:number,y:number,label:string};

export function MonthSchedule({state,employees,anchor,today,onPick,onSave,onMonth,readOnly}:{state:Team,employees:Team['employees'],anchor:string,today:string,onPick:(date:string)=>void,onSave?:(shifts:Team['shifts'])=>Promise<boolean>,onMonth?:(anchor:string)=>void,readOnly?:boolean}){
 const weekStart=((state.settings as any).weekStart||'mon') as 'mon'|'sun',days=monthGrid(anchor,weekStart),month=anchor.slice(0,7);
 const ids=new Set(employees.map(e=>e.id)),name=(id:string)=>employees.find(e=>e.id===id)?.name||'';
 // 지시서 3주차 025: 승인된 휴가를 근무표에 같이 보여 준다
 const leaves:{employeeId:string,start:string,end:string}[]=((state as any).approvedLeaves||[]).filter((l:any)=>ids.has(l.employeeId));
 const holidays=new Map((PUBLIC_HOLIDAYS[Number(month.slice(0,4))]||[]) as [string,string][]);
 const heads=weekStart==='mon'?'월화수목금토일':'일월화수목금토';
 const shifts=state.shifts.filter(x=>ids.has(x.employeeId)&&x.date.slice(0,7)===month);
 const hours=shifts.reduce((n,x)=>{let m=(Number(x.end.slice(0,2))*60+Number(x.end.slice(3)))-(Number(x.start.slice(0,2))*60+Number(x.start.slice(3)));if(m<=0)m+=1440;return n+Math.max(0,m-x.breakMinutes)/60},0);
 const canMove=!!onSave&&!readOnly;
 const [drag,setDrag]=useState<Drag|null>(null),[kb,setKb]=useState<{id:string,date:string}|null>(null),[msg,setMsg]=useState(''),[undo,setUndo]=useState<{id:string,from:string,text:string}|null>(null),[picked,setPicked]=useState(''),[mobile,setMobile]=useState(false);
 const press=useRef<{id:string,x:number,y:number,type:string,timer:any,active:boolean}|null>(null),suppress=useRef(false),edge=useRef<{side:number,timer:any}|null>(null),undoTimer=useRef<any>(null),dragRef=useRef<Drag|null>(null);
 dragRef.current=drag;
 useEffect(()=>{const q=matchMedia('(max-width: 700px)');const f=()=>setMobile(q.matches);f();q.addEventListener('change',f);return ()=>q.removeEventListener('change',f)},[]);
 // 끄는 동안 페이지 스크롤과 글자 선택 막기
 // 터치를 시작할 때부터 막을 수 있게 달력 전체에 항상 걸어 두고, 끄는 중일 때만 스크롤을 막는다
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{const el=root.current;if(!el)return;const stop=(e:TouchEvent)=>{if(press.current?.active)e.preventDefault()};el.addEventListener('touchmove',stop,{passive:false});return ()=>el.removeEventListener('touchmove',stop)},[]);
 useEffect(()=>{if(!drag)return;document.body.classList.add('ms-dragging');return ()=>document.body.classList.remove('ms-dragging')},[!!drag]);
 useEffect(()=>()=>{clearTimeout(undoTimer.current);clearTimeout(edge.current?.timer)},[]);
 const shiftById=(id:string)=>state.shifts.find(x=>x.id===id);
 // 끄는 동안 막힌 칸: 이유를 미리 계산
 const active=drag?.id||kb?.id||'',blocked=useMemo(()=>{const m=new Map<string,string>();const sh=active&&shiftById(active);if(!sh)return m;for(const d of days){const r=moveBlockReason(state,sh,d);if(r)m.set(d,r)}return m},[active,anchor,state]);
 async function drop(id:string,date:string){
  const sh=shiftById(id);if(!sh||!onSave||date===sh.date)return;
  const r=moveShift(state,id,date);if(r.reason){setMsg(r.reason);return}
  if(await onSave(r.shifts)){const text=moveMessage(name(sh.employeeId),sh.date,date);setMsg(text);clearTimeout(undoTimer.current);setUndo({id,from:sh.date,text});undoTimer.current=setTimeout(()=>setUndo(null),5000)}
 }
 async function revert(){if(!undo||!onSave)return;const u=undo;setUndo(null);clearTimeout(undoTimer.current);if(await onSave(state.shifts.map(x=>x.id===u.id?{...x,date:u.from}:x)))setMsg('되돌렸어요.')}
 // 손가락 아래 칸 찾기(되돌리기 띠 같은 게 위에 있어도 그 아래 칸을 찾는다)
 const cellAt=(x:number,y:number)=>{for(const el of document.elementsFromPoint(x,y)){const c=(el as HTMLElement).closest?.('[data-date]');if(c)return c.getAttribute('data-date')}return null};
 function onDown(e:React.PointerEvent,id:string,label:string){
  if(!canMove||e.button!==0)return;
  suppress.current=false;const p={id,x:e.clientX,y:e.clientY,type:e.pointerType,timer:null as any,active:false};press.current=p;
  const start=(x:number,y:number)=>{p.active=true;suppress.current=true;if(navigator.vibrate)try{navigator.vibrate(15)}catch{}setDrag({id,from:shiftById(id)!.date,over:cellAt(x,y),x,y,label})};
  if(e.pointerType!=='mouse')p.timer=setTimeout(()=>start(p.x,p.y),400);
  const move=(ev:PointerEvent)=>{
   if(!p.active){const far=Math.hypot(ev.clientX-p.x,ev.clientY-p.y);if(p.type==='mouse'&&far>5)start(ev.clientX,ev.clientY);else if(p.type!=='mouse'&&far>8){clearTimeout(p.timer);cleanup()}p.x=ev.clientX;p.y=ev.clientY;return}
   const over=cellAt(ev.clientX,ev.clientY);setDrag(d=>d&&{...d,over,x:ev.clientX,y:ev.clientY});
   // 화면 왼쪽·오른쪽 끝에 0.8초 머물면 이전 달·다음 달
   const side=ev.clientX<36?-1:ev.clientX>innerWidth-36?1:0;
   if(side!==(edge.current?.side||0)){clearTimeout(edge.current?.timer);edge.current=side?{side,timer:setTimeout(()=>{onMonth?.(monthShift(anchor,side));edge.current=null},800)}:null}
  };
  const up=(ev:PointerEvent)=>{clearTimeout(p.timer);clearTimeout(edge.current?.timer);edge.current=null;const d=dragRef.current;cleanup();if(p.active)setTimeout(()=>{suppress.current=false},60);if(p.active&&d){setDrag(null);const over=cellAt(ev.clientX,ev.clientY);if(over&&ev.type==='pointerup')void drop(id,over)}};
  const cleanup=()=>{removeEventListener('pointermove',move);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);press.current=null};
  addEventListener('pointermove',move);addEventListener('pointerup',up);addEventListener('pointercancel',up);
 }
 function onKey(e:React.KeyboardEvent,id:string,date:string){
  if(!canMove)return;
  if(e.key===' '){e.preventDefault();if(!kb){setKb({id,date});setMsg(`${name(shiftById(id)!.employeeId)} ${dayLabel(date)} 근무를 잡았어요. 방향키로 옮기고 Space로 놓으세요. 취소는 Esc.`)}else{const k=kb;setKb(null);if(k.date===shiftById(k.id)?.date)setMsg('제자리에 놓았어요.');else void drop(k.id,k.date)}return}
  if(e.key==='Escape'&&kb){e.preventDefault();setKb(null);setMsg('옮기기를 취소했어요.');return}
  const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key as 'ArrowLeft'];
  if(kb&&step){e.preventDefault();const next=plus(kb.date,step);setKb({...kb,date:next});if(next.slice(0,7)!==month)onMonth?.(next);const r=blocked.get(next);setMsg(`${dayLabel(next)}${r?' · '+r:''}`)}
 }
 const bar=(x:Team['shifts'][number],where:'cell'|'list')=>{const label=`${name(x.employeeId)} ${x.start.slice(0,5)}–${x.end.slice(0,5)}`;
  return <button type="button" key={x.id+where} className={'month-bar'+(drag?.id===x.id||kb?.id===x.id?' lifting':'')} data-shift={x.id} style={{borderLeftColor:empColor(x.employeeId,employees.map(e=>e.id))}}
   aria-label={`${label}, ${dayLabel(x.date)}. 누르면 그날 시간표.${canMove?' 꾹 눌러 끌거나 Space로 잡아 옮기기.':''}`}
   onPointerDown={e=>onDown(e,x.id,label)} onContextMenu={e=>{if(canMove)e.preventDefault()}} onKeyDown={e=>onKey(e,x.id,x.date)}
   onClick={()=>{if(suppress.current){suppress.current=false;return}if(kb)return;onPick(x.date)}}>
   {name(x.employeeId)} <i>{x.start.slice(0,2)}–{x.end.slice(0,2)}</i></button>};
 const target=drag?.over||kb?.date||'';
 const dayList=picked?state.shifts.filter(x=>ids.has(x.employeeId)&&x.date===picked).sort((a,b)=>a.start.localeCompare(b.start)):[];
 return <div className="month-sched" ref={root}>
  <p className="month-sum">{Number(month.slice(5))}월 근무 {shifts.length}개 · 예정 근무시간 {Math.round(hours)}시간</p>
  <div className="month-grid" role="grid" aria-label={`${Number(month.slice(5))}월 근무표`}>
   {heads.split('').map((h,i)=><div key={h} role="columnheader" className={'month-head'+((weekStart==='mon'?i===6:i===0)?' sun':'')}>{h}</div>)}
   {days.map(d=>{const list=state.shifts.filter(x=>ids.has(x.employeeId)&&x.date===d).sort((a,b)=>a.start.localeCompare(b.start)),out=d.slice(0,7)!==month,hol=holidays.get(d),dow=new Date(d+'T00:00:00Z').getUTCDay();
    const dragging=!!(drag||kb),no=dragging&&blocked.get(d),isTarget=target===d;
    return <div role="gridcell" key={d} data-date={d} className={'month-cell'+(out?' out':'')+(d===today?' today':'')+(hol||dow===0?' sun':'')+(dragging?(no?' drop-no':' drop-ok'):'')+(isTarget?' drop-target':'')+(picked===d?' picked':'')} title={no||undefined}>
     <button type="button" className="month-daybtn" onClick={()=>{if(mobile){setPicked(picked===d?'':d)}else onPick(d)}} aria-label={`${Number(d.slice(5,7))}월 ${Number(d.slice(8))}일${hol?' '+hol:''} 근무 ${list.length}개${leaves.some(l=>l.start<=d&&d<=l.end)?' · 휴가 있음':''}${mobile?' · 누르면 근무 목록':' · 누르면 그날 시간표'}`} aria-expanded={mobile?picked===d:undefined}>
      <span className="month-day">{Number(d.slice(8))}{hol&&<small>{hol}</small>}</span>
      {list.length>0&&<span className="month-count">{list.slice(0,2).map(x=>name(x.employeeId).slice(-2)).join('·')}{list.length>2?` +${list.length-2}`:''}</span>}
     </button>
     {(()=>{const off=leaves.filter(l=>l.start<=d&&d<=l.end).map(l=>name(l.employeeId)).filter(Boolean);return off.length?<span className="month-leave">휴가 {off.join('·')}</span>:null})()}
     <span className="month-list">{list.slice(0,4).map(x=>bar(x,'cell'))}{list.length>4&&<button type="button" className="month-more" onClick={()=>onPick(d)}>+{list.length-4}</button>}</span>
     {isTarget&&no&&<span className="month-why" aria-hidden="true">{no}</span>}
    </div>})}
  </div>
  {mobile&&picked&&<section ref={el=>{if(el&&el.dataset.day!==picked){el.dataset.day=picked;requestAnimationFrame(()=>el.scrollIntoView({block:'nearest',behavior:'smooth'}))}}} className="month-daylist" aria-label={`${dayLabel(picked)} 근무`}>
   <div className="month-daylist-head"><b>{dayLabel(picked)} 근무 {dayList.length}개</b><button type="button" onClick={()=>onPick(picked)}>그날 시간표 보기 →</button></div>
   {dayList.length?<div className="month-daylist-bars">{dayList.map(x=>bar(x,'list'))}</div>:<p>잡힌 근무가 없어요.</p>}
   {canMove&&dayList.length>0&&<p className="footnote">근무를 꾹 눌러 위 달력의 다른 날로 끌면 옮겨져요.</p>}
  </section>}
  {drag&&<div className="month-ghost" style={{left:drag.x,top:drag.y}} aria-hidden="true">{drag.label}{drag.over&&blocked.get(drag.over)?<small>{blocked.get(drag.over)}</small>:drag.over&&drag.over!==drag.from?<small>{dayLabel(drag.over)}로</small>:null}</div>}
  <p className="sr-only" role="status" aria-live="polite">{msg}</p>
  {msg&&!undo&&!drag&&<p className="month-msg" aria-hidden="true">{msg}</p>}
  {undo&&<div className={'month-undo'+(drag?' dim':'')} role="status"><span>{undo.text}</span><button type="button" onClick={revert}>되돌리기</button></div>}
  <p className="footnote">{canMove?'근무를 짧게 누르면 그날 시간표, 꾹 누르면(PC는 바로) 끌어서 다른 날로 옮겨요. 키보드는 Space로 잡고 방향키로 옮겨요.':'날짜를 누르면 그날 시간별 근무표로 가요.'}{mobile?' 휴대폰에서는 날짜를 누르면 그날 근무가 아래에 펼쳐져요.':''}</p>
 </div>;
}
