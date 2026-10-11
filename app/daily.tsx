'use client';
// 오늘의 일과: 매일 반복 퀘스트. 오픈 전 · 영업 중 · 마감 후에 챙길 일을 기록으로 판정해 체크해 주고,
// '바로 하기'를 누르면 그 화면으로 옮겨 누를 곳을 짚어 준다(app/quests.tsx의 짚기를 빌려 씀).
// 다 끝내면 오늘 도장 + 연속 완주 일수(🔥). 놓친 일은 마감 시각에 알림으로도 한 번 알려 준다(cron).
import {useEffect,useRef,useState} from 'react';
import {routineFor,streakOf,kday,SLOT_NAMES,type RoutineRole,type RoutineSlot,type RoutineTask} from '../lib/daily-routine';
import {startGuide} from './quests';

type Store={date?:string;pings?:string[];marks?:string[];mini?:boolean};
const mem:Record<string,Store>={};
// 매장(지점)·사람마다 따로 기억한다(여러 지점·같은 기기를 쓰는 직원이 서로 섞이지 않게)
const keyOf=(role:RoutineRole,demo:boolean,scope:string)=>`cc-daily-${role}${demo?'-demo':''}-v2:${scope}`;
/** 체험 화면 '처음 상태로' */
export const resetDemoDaily=()=>{for(const k of Object.keys(mem))if(k.includes('-demo-'))delete mem[k]};
function load(k:string,demo:boolean):Store{if(!mem[k]){let v:Store={};if(!demo)try{v=JSON.parse(localStorage.getItem(k)||'{}')||{}}catch{}mem[k]=v}return mem[k]}
function store(k:string,demo:boolean,patch:Store){mem[k]={...load(k,demo),...patch};if(!demo)try{localStorage.setItem(k,JSON.stringify(mem[k]))}catch{}}
const TOL:Record<string,number>={lenient:10,normal:5,strict:0};
const ORDER:RoutineSlot[]=['open','during','close','week','month'];
const dateLabel=(ms:number)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short'}).format(new Date(ms));

export function DailyBoard({role,state,branch,selfId='',demo=false}:{role:RoutineRole,state:any,branch:string,selfId?:string,demo?:boolean}){
 const k=keyOf(role,demo,role==='owner'?branch:selfId||branch),[now,setNow]=useState(()=>Date.now()),[,force]=useState(0),[party,setParty]=useState(false),[showDone,setShowDone]=useState(false),box=useRef<HTMLElement>(null);
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(t)},[]);
 const today=kday(now),st=load(k,demo),pings=st.date===today?st.pings||[]:[];
 const r=routineFor(role,state,branch,selfId,now,pings,TOL[state?.settings?.attendanceTolerance||'normal']??5);
 const marks=st.marks||[],closed=(state?.branches||[]).find((b:any)=>b.id===branch)?.closedDays||[],streak=streakOf(r.all?[...marks,today]:marks,today,role==='owner'?closed:[]);
 const set=(p:Store)=>{store(k,demo,p);force(n=>n+1)};
 // 다 끝낸 순간: 오늘 도장(처음 열었을 때 이미 끝나 있으면 조용히 도장만)
 const was=useRef<boolean|null>(null);
 useEffect(()=>{if(r.all&&!marks.includes(today))set({marks:[...marks.filter(d=>d>=kday(now-60*86400000)),today]});if(was.current===false&&r.all&&!(navigator as any).webdriver)setParty(true);was.current=r.all},[r.all,today]);// eslint-disable-line
 // 알림에서 열었을 때(/app?daily=1) 이 칸으로
 useEffect(()=>{const q=new URLSearchParams(location.search);if(q.get('daily')==='1'){if(st.mini)set({mini:false});setTimeout(()=>{box.current?.scrollIntoView({block:'start'});box.current?.focus()},400);
  // 한 번만: 새로고침할 때마다 다시 펼치고 옮기지 않게 주소에서 지운다
  q.delete('daily');try{history.replaceState(history.state,'',location.pathname+(q.toString()?'?'+q:'')+location.hash)}catch{}}},[]);// eslint-disable-line
 if(!r.total)return null;
 // 확인한 줄은 사라지므로, 키보드 초점을 다음 할 일(없으면 일과 칸)로 옮긴다
 const check=(id:string)=>{set({date:today,pings:[...new Set([...pings,id])]});setTimeout(()=>{(box.current?.querySelector<HTMLElement>('.db-act')||box.current)?.focus()},0)};
 const fold=(mini:boolean)=>{set({mini});setTimeout(()=>document.querySelector<HTMLElement>(mini?'.db-mini':'#db-title')?.closest<HTMLElement>(mini?'.db-mini':'.db')?.focus(),0)};
 const pct=Math.round(r.done/r.total*100);
 // 남은 일만 보여 준다(끝낸 일은 한 줄로 접어 둠)
 const shown=showDone?r.tasks:r.tasks.filter(t=>t.status!=='done');
 if(st.mini)return <button type="button" className="db-mini" onClick={()=>fold(false)} aria-expanded={false}><span aria-hidden="true">☀️</span><b>오늘의 일과 {r.done}/{r.total}</b>{streak>0&&<span className="db-mini-fire">🔥 {streak}일 연속</span>}<span className="db-mini-go">{r.all?'완주!':'펼치기 ▸'}</span></button>;
 const go=(t:RoutineTask)=>startGuide(role,{id:t.id,emoji:t.emoji,title:t.title,page:t.page,steps:t.steps});
 return <section ref={box} tabIndex={-1} className={'db'+(r.all?' all':'')} aria-labelledby="db-title">
  <div className="db-head">
   <div className="db-ring" style={{['--db-p' as any]:pct}} role="img" aria-label={`${r.total}개 중 ${r.done}개 끝`}><b>{r.done}</b><small>/{r.total}</small></div>
   <div className="db-meta"><h2 id="db-title">☀️ 오늘의 일과</h2><p>{dateLabel(now)} · 지금은 <b>{SLOT_NAMES[r.slot]}</b></p></div>
   <div className={'db-streak'+(streak?'':' cold')}><span aria-hidden="true">🔥</span><b>{streak}</b><small>일 연속</small></div>
   <button type="button" className="qb-text db-fold" onClick={()=>fold(true)}>접기</button>
  </div>
  {r.all&&<p className={'db-clear'+(party?' party':'')} role="status"><span className="db-stamp" aria-hidden="true">완주</span>오늘 일과를 다 끝냈어요! {streak>1?`${streak}일째 이어 가는 중이에요.`:'내일도 이어 가 볼까요?'}</p>}
  <ol className="db-slots">{ORDER.filter(sl=>shown.some(t=>t.slot===sl)).map(sl=><li key={sl} className={sl===r.slot?'now':''}>
   <h3>{SLOT_NAMES[sl]}{sl===r.slot&&<em>지금</em>}</h3>
   <ul>{shown.filter(t=>t.slot===sl).map(t=>{const done=t.status==='done';return <li key={t.id} className={'db-task '+t.status+(t.warn&&!done?' warn':'')}>
    <span className="db-check" aria-hidden="true">{done?'✓':t.status==='wait'?'⏳':t.emoji}</span>
    <div className="db-body"><b>{t.title}<span className="sr-only">{done?' 끝':t.status==='wait'?' 기다리는 중':' 남음'}</span></b><small>{t.detail}</small>
     {!done&&t.lines&&t.lines.length>0&&<ul className="db-lines">{t.lines.map((l,i)=><li key={i}>{l}</li>)}</ul>}</div>
    {!done&&t.status!=='wait'&&(t.page||t.steps)&&(!t.check||t.warn)&&<button type="button" className="db-act" onClick={()=>go(t)}>바로 하기 ▶</button>}
    {!done&&t.check&&<button type="button" className="db-act ok" onClick={()=>check(t.id)}>확인했어요</button>}
   </li>})}</ul>
  </li>)}</ol>
  {r.done>0&&!r.all&&<button type="button" className="db-donebtn" aria-expanded={showDone} onClick={()=>setShowDone(!showDone)}>✓ 끝낸 일 {r.done}개 {showDone?'접기':'보기'}</button>}
  <div className="db-bar" aria-hidden="true"><i style={{width:pct+'%'}}/></div>
 </section>;
}
