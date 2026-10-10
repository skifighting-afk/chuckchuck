'use client';
// 처음 시작 가이드(튜토리얼): 화면의 실제 버튼을 하나씩 밝혀 주며 따라가게 한다.
// - 처음 들어온 사장님·직원에게 한 번 자동으로 열리고, 도움말·시작하기 칸·주소(?tour=1)로 다시 볼 수 있다(이 기기에 기억).
// - 키보드: → 다음, ← 이전, Esc 닫기. 화면 낭독기: 대화상자로 읽히고 단계 글이 바로 읽힌다.
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {TOURS,type TourRole,type TourStep} from '../lib/tour-steps';

const KEY=(role:TourRole)=>`cc-tour-${role}-v1`;
export const tourSeen=(role:TourRole)=>{try{return localStorage.getItem(KEY(role))==='done'}catch{return true}};
const markSeen=(role:TourRole)=>{try{localStorage.setItem(KEY(role),'done')}catch{}};
/** 다른 화면에서 가이드를 다시 열 때 */
export const startTour=(role:TourRole)=>{try{localStorage.removeItem(KEY(role))}catch{};window.dispatchEvent(new CustomEvent('cc-tour',{detail:role}))};

function findTarget(step:TourStep):HTMLElement|null{
 const mobile=window.innerWidth<768;
 for(const sel of (mobile&&step.mobile?step.mobile:step.target||[])){const el=document.querySelector(sel) as HTMLElement|null;if(el&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden')return el}
 return null;
}

export function Tour({role,go,auto=true}:{role:TourRole,go?:(page:string)=>void,auto?:boolean}){
 const steps=TOURS[role],[i,setI]=useState(-1),[rect,setRect]=useState<DOMRect|null>(null),card=useRef<HTMLDivElement>(null),lastFocus=useRef<HTMLElement|null>(null);
 const open=i>=0,step=open?steps[i]:null;
 const close=useCallback((done:boolean)=>{markSeen(role);setI(-1);setRect(null);if(done)try{window.dispatchEvent(new CustomEvent('cc-tour-done',{detail:role}))}catch{};lastFocus.current?.focus?.()},[role]);
 // 처음 한 번 자동 · ?tour=1
 useEffect(()=>{
  const q=new URLSearchParams(location.search).get('tour')==='1';
  // 자동 열기는 사람이 쓸 때만(자동 점검 브라우저에서는 열지 않음)
  if(!q&&!(auto&&!tourSeen(role)&&!(navigator as any).webdriver))return;
  const t=setTimeout(()=>{lastFocus.current=document.activeElement as HTMLElement;setI(0)},q?300:900);return()=>clearTimeout(t);
 },[role,auto]);
 // 다른 곳에서 startTour()로 다시 열기
 useEffect(()=>{const h=(e:Event)=>{if((e as CustomEvent).detail===role){lastFocus.current=document.activeElement as HTMLElement;setI(0)}};window.addEventListener('cc-tour',h);return()=>window.removeEventListener('cc-tour',h)},[role]);
 // 단계가 바뀌면: 필요한 화면으로 옮기고, 대상을 찾아 화면 가운데로
 useEffect(()=>{
  if(!step)return;if(step.page&&go)go(step.page);
  let tries=0,timer:any;const seek=()=>{const el=findTarget(step);if(el){el.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});setTimeout(()=>setRect(el.getBoundingClientRect()),280)}else if(++tries<8)timer=setTimeout(seek,150);else setRect(null)};
  setRect(null);seek();return()=>clearTimeout(timer);
 },[i]);
 // 크기·스크롤이 바뀌면 다시 재기
 useEffect(()=>{if(!step)return;const re=()=>{const el=findTarget(step);setRect(el?el.getBoundingClientRect():null)};addEventListener('resize',re);addEventListener('scroll',re,true);return()=>{removeEventListener('resize',re);removeEventListener('scroll',re,true)}},[i]);
 useLayoutEffect(()=>{if(open)card.current?.focus()},[i,open]);
 useEffect(()=>{if(!open)return;const k=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();close(false)}else if(e.key==='ArrowRight'){e.preventDefault();next()}else if(e.key==='ArrowLeft'){e.preventDefault();prev()}};addEventListener('keydown',k,true);return()=>removeEventListener('keydown',k,true)},[open,i]);
 const next=()=>{if(i>=steps.length-1){close(true);return}setI(i+1)};
 const prev=()=>{if(i>0)setI(i-1)};
 if(!open||!step)return null;
 const pad=8,mobile=typeof window!=='undefined'&&window.innerWidth<600,vw=typeof window!=='undefined'?window.innerWidth:390,vh=typeof window!=='undefined'?window.innerHeight:800;
 const hole=rect?{top:Math.max(4,rect.top-pad),left:Math.max(4,rect.left-pad),width:Math.min(vw-8,rect.width+pad*2),height:Math.min(vh-8,rect.height+pad*2)}:null;
 // 설명 카드 위치: 휴대폰은 아래(대상이 아래쪽이면 위)에 고정, 넓은 화면은 대상 옆
 let pos:any;
 if(!hole)pos={left:'50%',top:'50%',transform:'translate(-50%,-50%)',width:Math.min(440,vw-24)};
 else if(mobile)pos=hole.top+hole.height>vh*0.55?{left:12,right:12,top:12}:{left:12,right:12,bottom:12};
 else{const w=360,below=hole.top+hole.height+12,right=hole.left+hole.width+16;
  if(below+240<vh)pos={width:w,left:Math.min(Math.max(12,hole.left),vw-w-12),top:below};// 아래
  else if(hole.top-12>240)pos={width:w,left:Math.min(Math.max(12,hole.left),vw-w-12),bottom:vh-hole.top+12};// 위
  else if(right+w+12<vw)pos={width:w,left:right,top:Math.min(Math.max(12,hole.top),vh-320)};// 오른쪽(세로로 긴 메뉴 등)
  else if(hole.left-w-16>12)pos={width:w,left:hole.left-w-16,top:Math.min(Math.max(12,hole.top),vh-320)};// 왼쪽
  else pos={width:w,left:'50%',bottom:24,transform:'translateX(-50%)'};}
 const action=step.action;
 return <div className="tour-root">
  {hole?<div className="tour-hole" style={hole}/>:<div className="tour-dim"/>}
  <div className="tour-block" onClick={e=>e.stopPropagation()}/>
  <div ref={card} className={'tour-card'+(mobile?' tour-sheet':'')} style={{...pos,maxHeight:'calc(100vh - 24px)',overflowY:'auto'}} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body" tabIndex={-1}>
   <div className="tour-progress" aria-label={`${steps.length}단계 중 ${i+1}단계`}>{steps.map((_,n)=><i key={n} className={n===i?'on':n<i?'done':''}/>)}</div>
   {step.emoji&&<div className="tour-emoji" aria-hidden="true">{step.emoji}</div>}
   <h2 id="tour-title">{step.title}</h2>
   <p id="tour-body" aria-live="polite">{step.body}</p>
   {step.tip&&<p className="tour-tip">💡 {step.tip}</p>}
   <div className="tour-actions">
    <button type="button" className="tour-skip" onClick={()=>close(false)}>{i===steps.length-1?'닫기':'건너뛰기'}</button>
    <span className="tour-count">{i+1} / {steps.length}</span>
    {i>0&&<button type="button" className="secondary" onClick={prev}>이전</button>}
    {action&&i===steps.length-1?<button type="button" className="primary" onClick={()=>{close(true);if(action.page&&go)go(action.page);if(action.href)location.assign(action.href)}}>{action.label}</button>:<button type="button" className="primary" onClick={next}>{i===steps.length-1?'시작하기':'다음'}</button>}
   </div>
  </div>
 </div>;
}

/** 도움말·설정 등에서 '가이드 다시 보기' */
export function TourButton({role,label='처음 시작 가이드 다시 보기'}:{role:TourRole,label?:string}){
 return <button type="button" className="secondary tour-again" onClick={()=>{if(location.pathname.startsWith('/app')||location.pathname.startsWith('/demo'))startTour(role);else location.assign((role==='staff'?'/app':'/app')+'?tour=1')}}>🧭 {label}</button>;
}
