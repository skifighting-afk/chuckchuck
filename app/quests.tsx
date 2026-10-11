'use client';
// 시작 퀘스트: 홈의 퀘스트 보드에서 고르고, 실제 화면에서 "여기에 입력" 하고 칸을 하나씩 짚어 준다.
// - 짚기(QuestHost): 화면을 막지 않는 반짝이는 테두리 + 말풍선. 누르거나 입력하면 다음 칸으로 넘어가고, 창이 닫히면 앞 단계로 돌아간다.
// - 완료: 가게 기록으로 판정 → 직접 시작한 퀘스트는 축하 창(경험치·배지·레벨 업), 그 밖에는 짧은 알림.
// - 자동 점검 브라우저(navigator.webdriver)에서는 저절로 뜨는 것이 없다.
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {QUESTS,questDone,questSummary,levelOf,parseFind,type Quest,type QuestRole} from '../lib/quests';
import {startTour} from './tour';

type Store={pings?:string[];seenBy?:Record<string,string[]>;mini?:boolean;hideAll?:boolean};
const mem:Record<string,Store>={};
const keyOf=(role:QuestRole,demo:boolean)=>`cc-quest-${role}${demo?'-demo':''}-v1`;
function getStore(k:string,demo:boolean):Store{if(!mem[k]){let v:Store={};if(!demo)try{v=JSON.parse(localStorage.getItem(k)||'{}')||{}}catch{}mem[k]=v}return mem[k]}
function setStore(k:string,demo:boolean,patch:Store){mem[k]={...getStore(k,demo),...patch};if(!demo)try{localStorage.setItem(k,JSON.stringify(mem[k]))}catch{};try{window.dispatchEvent(new CustomEvent('cc-quest-store',{detail:k}))}catch{}}
function useQuestStore(role:QuestRole,demo:boolean):[Store,(p:Store)=>void]{
 const k=keyOf(role,demo),[s,setS]=useState<Store>(()=>getStore(k,demo));
 useEffect(()=>{const h=(e:Event)=>{if((e as CustomEvent).detail===k)setS({...getStore(k,demo)})};addEventListener('cc-quest-store',h);return()=>removeEventListener('cc-quest-store',h)},[k,demo]);
 return [s,useCallback((p:Store)=>setStore(k,demo,p),[k,demo])];
}
/** 보드·도움말에서 퀘스트 시작 */
export const startQuest=(role:QuestRole,id:string)=>{try{window.dispatchEvent(new CustomEvent('cc-quest-start',{detail:{role,id}}))}catch{}};
/** 하루 일과 등에서 짚기만 빌려 쓰기: 화면을 옮기고(page) 칸을 짚는다(steps). 마지막 단계를 누르면 끝난다 */
export const startGuide=(role:QuestRole,g:{id:string,emoji:string,title:string,page?:string,steps?:any[]})=>{try{window.dispatchEvent(new CustomEvent('cc-quest-start',{detail:{role,id:g.id,guide:g}}))}catch{}};
/** 기기·설정상 못 하는 퀘스트(needs 요소가 화면에 없음). 한 번이라도 보이면 계속 보인다 */
const present=new Set<string>();
function useSkip(role:QuestRole){
 const [skip,setSkip]=useState<string[]>([]);
 useEffect(()=>{const check=()=>{const m:string[]=[];for(const q of QUESTS[role])if(q.needs){if(document.querySelector(q.needs))present.add(q.id);if(!present.has(q.id))m.push(q.id)}setSkip(o=>o.join()===m.join()?o:m)};const t=setTimeout(check,700),i=setInterval(check,2500);return()=>{clearTimeout(t);clearInterval(i)}},[role]);
 return skip;
}
const robot=()=>typeof navigator!=='undefined'&&!!(navigator as any).webdriver;
const reduced=()=>typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── 화면에서 칸 찾기 ──
function shown(el:Element|null):el is HTMLElement{
 if(!el||!(el as HTMLElement).getClientRects().length)return false;
 if(el.closest('[aria-hidden="true"],[inert]'))return false;// 창이 열리면 뒤 화면은 가려진다
 const cs=getComputedStyle(el);return cs.visibility!=='hidden'&&cs.display!=='none';
}
const norm=(t:string|null)=>(t||'').replace(/\s+/g,' ').trim();
export function findEl(f:string):HTMLElement|null{
 const p=parseFind(f);
 if(p.field){
  const roots:ParentNode[]=p.scope?Array.from(document.querySelectorAll(p.scope)) as ParentNode[]:[document];
  for(const r of roots)for(const lab of r.querySelectorAll('label.t-field')){const sp=lab.querySelector(':scope>span');if(sp&&norm(sp.textContent).startsWith(p.field)){const el=lab.querySelector('input,select,textarea');if(shown(el))return el}}
  return null;
 }
 let list:Element[]=[];try{list=[...document.querySelectorAll(p.css)]}catch{return null}
 for(const el of list){if(!shown(el))continue;if(p.text!==undefined){const t=norm(el.textContent);if(p.exact?t!==p.text:!t.includes(p.text))continue}return el}
 return null;
}
const stepEl=(q:Quest,i:number)=>{for(const f of q.steps[i]?.find||[]){const el=findEl(f);if(el)return el}return null};
const filled=(el:Element)=>{const v=(el as HTMLInputElement).value;return typeof v==='string'&&v.trim()!==''};

// ── 퀘스트 진행(모든 화면에 한 번 둔다) ──
export function QuestHost({role,state,branch,selfId='',demo=false,go}:{role:QuestRole,state:any,branch:string,selfId?:string,demo?:boolean,go?:(page:string)=>void}){
 const [store,save]=useQuestStore(role,demo);
 const done=questDone(role,state,branch,selfId,store.pings||[]),skip=useSkip(role);
 const [active,setActive]=useState<Quest|null>(null),[idx,setIdx]=useState(0),[rect,setRect]=useState<DOMRect|null>(null),[lost,setLost]=useState(false);
 const [party,setParty]=useState<{q:Quest,prevXp:number}|null>(null),[toast,setToast]=useState<Quest|null>(null);
 const idxRef=useRef(0);idxRef.current=idx;
 const activeRef=useRef<Quest|null>(null);activeRef.current=active;
 const ping=useCallback((id:string)=>{const p=getStore(keyOf(role,demo),demo).pings||[];if(!p.includes(id))save({pings:[...p,id]})},[role,demo,save]);
 // 처음: 이미 끝난 퀘스트는 축하하지 않고 본 것으로
 const doneKey=Object.keys(done).filter(k=>done[k]).sort().join(',');
 const seenKey=role==='owner'?branch:selfId||'me';
 useEffect(()=>{
  const all=getStore(keyOf(role,demo),demo).seenBy||{},seen=all[seenKey];
  if(!seen){save({seenBy:{...all,[seenKey]:doneKey?doneKey.split(','):[]}});return}// 이 지점·이 사람은 처음: 축하 없이 기억만
  const fresh=QUESTS[role].filter(q=>done[q.id]&&!seen.includes(q.id));if(!fresh.length)return;
  save({seenBy:{...all,[seenKey]:[...seen,...fresh.map(q=>q.id)]}});
  const xpNow=QUESTS[role].filter(q=>done[q.id]).reduce((n,q)=>n+q.xp,0);
  const mine=fresh.find(q=>q.id===activeRef.current?.id);
  if(mine){setActive(null);setRect(null);setParty({q:mine,prevXp:xpNow-fresh.reduce((n,q)=>n+q.xp,0)})}
  else if(!robot()){setToast(fresh[0]);setTimeout(()=>setToast(t=>t===fresh[0]?null:t),4200)}
 },[doneKey,seenKey]);// eslint-disable-line
 // 기록에 안 남는 퀘스트: 화면에 보이면 완료
 useEffect(()=>{
  const t=setInterval(()=>{for(const q of QUESTS[role])if(q.doneSel&&!done[q.id]&&q.doneSel.some(f=>findEl(f)))ping(q.id)},800);
  return()=>clearInterval(t);
 },[role,doneKey,ping]);// eslint-disable-line
 // 보드에서 시작
 useEffect(()=>{const h=(e:Event)=>{const d=(e as CustomEvent).detail;if(d?.role!==role)return;const g=d.guide,q:Quest|undefined=g?{id:'guide:'+g.id,chapter:0,emoji:g.emoji,title:g.title,why:'',xp:0,minutes:1,badge:{emoji:'',name:''},page:g.page,steps:g.steps||[],guideOnly:true} as any:QUESTS[role].find(x=>x.id===d.id);if(!q)return;if(!q.steps.length){if(q.page&&go)go(q.page);return}setParty(null);setActive(q);setIdx(0);setLost(false);if(q.page&&go)go(q.page)};addEventListener('cc-quest-start',h);return()=>removeEventListener('cc-quest-start',h)},[role,go]);
 // 짚을 칸 따라가기
 useEffect(()=>{
  if(!active)return;let miss=0;
  const tick=()=>{
   const q=active,n=q.steps.length;let i=idxRef.current;const els=q.steps.map((_,k)=>stepEl(q,k));
   if(!els[i]){let j=-1;for(let k=i+1;k<n;k++)if(els[k]){j=k;break}if(j<0)for(let k=i-1;k>=0;k--)if(els[k]){j=k;break}if(j>=0)i=j}
   if(els[i]&&q.steps[i].kind==='check'&&(els[i] as HTMLInputElement).checked&&i<n-1)i++;
   if(i!==idxRef.current){idxRef.current=i;setIdx(i)}
   const el=els[i];cur=el;if(el){miss=0;setLost(false)}else{setRect(null);if(++miss>8)setLost(true)}
  };
  // 칸 위치는 매 프레임 따라간다(스크롤·창 움직임에 바로 맞춤)
  let cur:HTMLElement|null=null,raf=0;const follow=()=>{if(cur&&cur.isConnected){const r=cur.getBoundingClientRect();setRect(o=>o&&o.top===r.top&&o.left===r.left&&o.width===r.width&&o.height===r.height?o:r)}raf=requestAnimationFrame(follow)};
  tick();const t=setInterval(tick,250);raf=requestAnimationFrame(follow);
  const owner=(target:EventTarget|null)=>{const q=active;if(!(target instanceof Node))return -1;for(let k=q.steps.length-1;k>=0;k--){const el=stepEl(q,k);if(el&&(el===target||el.contains(target)))return k}return -1};
  const advance=(k:number)=>{const n=active.steps.length;const to=Math.min(n-1,k+1);idxRef.current=to;setIdx(to)};
  const onClick=(e:Event)=>{const k=owner(e.target);if(k<0)return;const st=active.steps[k];if(st.kind==='click'){if(k===active.steps.length-1&&active.doneOnLastClick)ping(active.id);if(k===active.steps.length-1&&(active as any).guideOnly){setTimeout(()=>{setActive(null);setRect(null)},600);return}advance(k)}else if(k>idxRef.current){idxRef.current=k;setIdx(k)}};
  const onFocus=(e:Event)=>{const k=owner(e.target);if(k>idxRef.current&&active.steps[k].kind!=='click'){idxRef.current=k;setIdx(k)}};
  const onChange=(e:Event)=>{const k=owner(e.target);if(k<0||k!==idxRef.current)return;const st=active.steps[k];if((st.kind==='fill'||st.kind==='pick')&&filled(e.target as Element))advance(k)};
  const onBlur=(e:Event)=>{const k=owner(e.target);if(k<0||k!==idxRef.current)return;const st=active.steps[k];if(st.kind==='pick'||(st.kind==='fill'&&filled(e.target as Element)))advance(k)};
  document.addEventListener('click',onClick,true);document.addEventListener('focusin',onFocus,true);document.addEventListener('change',onChange,true);document.addEventListener('focusout',onBlur,true);
  return()=>{clearInterval(t);cancelAnimationFrame(raf);document.removeEventListener('click',onClick,true);document.removeEventListener('focusin',onFocus,true);document.removeEventListener('change',onChange,true);document.removeEventListener('focusout',onBlur,true)};
 },[active,ping]);
 // 단계가 바뀌면 칸이 화면 밖이면 가운데로
 useEffect(()=>{if(!active)return;const t=setTimeout(()=>{const el=stepEl(active,idx);if(!el)return;const r=el.getBoundingClientRect();if(r.top<70||r.bottom>innerHeight-90)el.scrollIntoView({block:'center',behavior:reduced()?'auto':'smooth'})},120);return()=>clearTimeout(t)},[active,idx]);
 const stop=()=>{setActive(null);setRect(null)};
 const xp=QUESTS[role].filter(q=>done[q.id]).reduce((n,q)=>n+q.xp,0);
 return <>
  {active&&<QuestPointer q={active} i={idx} rect={rect}/>}
  {active&&<div className="qh-hud" role="status" aria-live="polite">
   <span className="qh-emoji" aria-hidden="true">{active.emoji}</span>
   <span className="qh-text"><b>{active.title}</b><small>{lost?'퀘스트 화면을 벗어났어요':`${idx+1}/${active.steps.length}단계`}</small><span className="sr-only">{lost?'':active.steps[idx]?.hint}</span></span>
   {lost&&active.page&&go&&<button type="button" className="qh-back" onClick={()=>{setLost(false);idxRef.current=0;setIdx(0);go(active.page!)}}>돌아가기</button>}
   <button type="button" className="qh-stop" onClick={stop} aria-label="퀘스트 그만하기">그만</button>
  </div>}
  {party&&<QuestParty skip={skip} role={role} q={party.q} prevXp={party.prevXp} xp={xp} done={done} demo={demo} onClose={()=>setParty(null)} onNext={q=>{setParty(null);startQuest(role,q.id)}}/>}
  {toast&&!party&&<div className="qh-toast" role="status"><span aria-hidden="true">{toast.badge.emoji}</span><span><b>퀘스트 완료 · {toast.title}</b><small>+{toast.xp} XP · 배지 「{toast.badge.name}」</small></span></div>}
 </>;
}

function QuestPointer({q,i,rect}:{q:Quest,i:number,rect:DOMRect|null}){
 const bubble=useRef<HTMLDivElement>(null),[bh,setBh]=useState(70);
 useLayoutEffect(()=>{if(bubble.current)setBh(bubble.current.offsetHeight)},[i,rect?.width]);
 if(!rect)return null;
 const vw=innerWidth,vh=innerHeight,pad=6,w=Math.min(300,vw-24);
 const ring={top:rect.top-pad,left:rect.left-pad,width:rect.width+pad*2,height:rect.height+pad*2};
 const below=rect.bottom+pad+14+bh<vh-8,left=Math.min(Math.max(12,rect.left+rect.width/2-w/2),vw-w-12);
 const top=below?rect.bottom+pad+12:Math.max(8,rect.top-pad-12-bh);
 const arrow=Math.min(Math.max(16,rect.left+rect.width/2-left),w-16);
 const step=q.steps[i];
 return <div className="qp-root" aria-hidden="true">
  <div className="qp-ring" style={ring}/>
  <div ref={bubble} className={'qp-bubble'+(below?' below':' above')} style={{top,left,width:w,['--qp-arrow' as any]:arrow+'px'}}>
   <span className="qp-point">{step?.kind==='click'?'👆 여기를 눌러요':step?.kind==='check'?'☑️ 여기를 체크':step?.kind==='pick'?'👇 여기서 골라요':'✍️ 여기에 입력'}</span>
   <span className="qp-hint">{step?.hint}</span>
   <span className="qp-steps">{q.steps.map((_,k)=><i key={k} className={k<i?'done':k===i?'on':''}/>)}</span>
  </div>
 </div>;
}

function Confetti(){
 if(reduced())return null;
 const colors=['#ffcf33','#5ec27f','#ff7a59','#4f8cff','#c77dff','#d4f77d'];
 return <div className="qc-confetti" aria-hidden="true">{Array.from({length:42},(_,k)=><i key={k} style={{left:(k*37%100)+'%',background:colors[k%colors.length],animationDelay:(k%7)*0.06+'s',['--qc-x' as any]:((k*53%120)-60)+'px',['--qc-r' as any]:(k*97%720)+'deg'}}/>)}</div>;
}

function QuestParty({skip,role,q,prevXp,xp,done,demo,onClose,onNext}:{skip:string[],role:QuestRole,q:Quest,prevXp:number,xp:number,done:Record<string,boolean>,demo:boolean,onClose:()=>void,onNext:(q:Quest)=>void}){
 const btn=useRef<HTMLButtonElement>(null),before=levelOf(role,prevXp),after=levelOf(role,xp),sum=questSummary(role,done,demo,skip),up=after.level>before.level;
 const [fill,setFill]=useState(before.max?100:before.level===after.level?before.pct:0);
 useEffect(()=>{btn.current?.focus();const t=setTimeout(()=>setFill(after.pct),350);const k=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};addEventListener('keydown',k);return()=>{clearTimeout(t);removeEventListener('keydown',k)}},[]);// eslint-disable-line
 return <div className="qc-root">
  <Confetti/>
  <div className="qc-card" role="dialog" aria-modal="true" aria-labelledby="qc-title" aria-describedby="qc-desc">
   <div className="qc-badge" aria-hidden="true">{q.badge.emoji}</div>
   <p className="qc-kicker">퀘스트 완료!</p>
   <h2 id="qc-title">{q.emoji} {q.title}</h2>
   <p id="qc-desc" className="qc-reward"><b>+{q.xp} XP</b> · 배지 「{q.badge.name}」 획득</p>
   {up?<p className="qc-up">🎉 레벨 업! <b>Lv.{after.level} {after.title}</b></p>:null}
   <div className="qc-level"><span>Lv.{after.level} {after.title}</span><span>{after.max?'최고 레벨':`${xp} / ${after.next} XP`}</span></div>
   <div className="qc-xpbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={after.pct} aria-label="다음 레벨까지"><i style={{width:fill+'%'}}/></div>
   <p className="qc-count">퀘스트 {sum.count}/{sum.list.length} 완료</p>
   <div className="qc-actions">
    {sum.next?<><button ref={btn} type="button" className="primary" onClick={()=>onNext(sum.next!)}>다음 퀘스트: {sum.next.emoji} {sum.next.title} ▶</button><button type="button" className="secondary" onClick={onClose}>나중에 할게요</button></>
     :<><p className="qc-all">🏆 모든 퀘스트를 깼어요! 이제 척척사장을 다 쓸 줄 아는 사장님이에요.</p><button ref={btn} type="button" className="primary" onClick={onClose}>좋아요</button></>}
   </div>
  </div>
 </div>;
}

// ── 퀘스트 보드(홈) ──
export function QuestBoard({role,state,branch,selfId='',demo=false}:{role:QuestRole,state:any,branch:string,selfId?:string,demo?:boolean}){
 const [store,save]=useQuestStore(role,demo);
 const skip=useSkip(role),done=questDone(role,state,branch,selfId,store.pings||[]),sum=questSummary(role,done,demo,skip),lv=sum.level;
 const who=role==='owner'?'사장님':'크루';
 if(sum.all){
  if(store.hideAll)return null;
  return <section className="qb qb-all" aria-label="퀘스트 완료"><span className="qb-trophy" aria-hidden="true">🏆</span><div><b>모든 퀘스트 완료 · Lv.{lv.level} {lv.title}</b><small>배지 {sum.list.length}개를 다 모았어요. {sum.list.map(q=>q.badge.emoji).join(' ')}</small></div><button type="button" className="qb-text" onClick={()=>save({hideAll:true})}>닫기</button></section>;
 }
 const next=sum.next!;
 if(store.mini)return <button type="button" className="qb-mini" onClick={()=>save({mini:false})} aria-expanded={false}><span aria-hidden="true">🎮</span><b>{who} 퀘스트 {sum.count}/{sum.list.length}</b><span className="qb-mini-lv">Lv.{lv.level} {lv.title}</span><span className="qb-mini-next">다음: {next.emoji} {next.title} ▸</span></button>;
 const ch=sum.chapters.findIndex(c=>c.quests.includes(next));
 return <section className="qb" aria-labelledby="qb-title">
  <div className="qb-head">
   <div className="qb-lv" aria-hidden="true"><small>Lv.</small><b>{lv.level}</b></div>
   <div className="qb-meta">
    <h2 id="qb-title">🎮 {who} 퀘스트</h2>
    <p><b>{lv.title}</b> · {lv.max?'최고 레벨':`다음 레벨까지 ${(lv.next||0)-sum.xp} XP`}</p>
    <div className="qb-xpbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={lv.pct} aria-label={`경험치 ${sum.xp} XP`}><i style={{width:lv.pct+'%'}}/></div>
   </div>
   <button type="button" className="qb-text" onClick={()=>save({mini:true})}>접기</button>
  </div>
  <div className="qb-next">
   <span className="qb-next-emoji" aria-hidden="true">{next.emoji}</span>
   <div className="qb-next-body">
    <small>다음 퀘스트 · {ch+1}장 {sum.chapters[ch]?.name}</small>
    <b>{next.title}</b>
    <p>{next.why}</p>
    <span className="qb-reward"><em>+{next.xp} XP</em><em>{next.badge.emoji} {next.badge.name}</em><em>약 {next.minutes}분</em></span>
   </div>
   <button type="button" className="qb-go" onClick={()=>startQuest(role,next.id)}>▶ 퀘스트 시작</button>
  </div>
  <ol className="qb-map">{sum.chapters.map((c,i)=><li key={c.name} className={c.done?'done':''}>
   <span className="qb-ch">{c.done?'✓ ':''}{i+1}장 · {c.name}</span>
   <div className="qb-nodes">{c.quests.map(q=>{const d=!!done[q.id],now=q===next;return <button type="button" key={q.id} className={'qb-node'+(d?' done':now?' now':'')} onClick={()=>startQuest(role,q.id)}>
    <span className="qb-node-ic" aria-hidden="true">{d?'✓':q.emoji}</span><span className="qb-node-t">{q.title}</span><span className="qb-node-xp">{d?'완료':'+'+q.xp}<span className="sr-only">{d?'':' XP 도전하기'}</span></span></button>})}</div>
  </li>)}</ol>
  <div className="qb-badges" role="group" aria-label={`배지 ${sum.count}/${sum.list.length}`}><small>배지 {sum.count}/{sum.list.length}</small>{sum.list.map(q=><span key={q.id} className={'qb-badge'+(done[q.id]?' got':'')} title={done[q.id]?q.badge.name:`${q.title}을(를) 깨면 열려요`}>{done[q.id]?q.badge.emoji:'？'}</span>)}</div>
  <p className="qb-foot">시작을 누르면 해당 화면으로 옮겨서 <b>어디를 누르고 어디에 입력하는지</b> 하나씩 짚어 드려요. <button type="button" className="qb-text" onClick={()=>startTour(role)}>🧭 화면 둘러보기</button></p>
 </section>;
}
