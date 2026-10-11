'use client';
// 시작 퀘스트: 홈의 퀘스트 보드에서 고르고, 실제 화면에서 "여기에 입력" 하고 칸을 하나씩 짚어 준다.
// - 짚기(QuestHost): 화면을 막지 않는 반짝이는 테두리 + 말풍선. 누르거나 입력하면 다음 칸으로 넘어가고, 창이 닫히면 앞 단계로 돌아간다.
// - 완료: 가게 기록으로 판정 → 직접 시작한 퀘스트는 축하 창(경험치·배지·레벨 업), 그 밖에는 짧은 알림.
// - 자동 점검 브라우저(navigator.webdriver)에서는 저절로 뜨는 것이 없다.
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {QUESTS,questDone,questSummary,levelOf,parseFind,type Quest,type QuestRole} from '../lib/quests';
import {useStartGuide} from './start-guide-store';

type Store={pings?:string[];seenBy?:Record<string,string[]>;mini?:boolean;hideAll?:boolean};
function useQuestStore(_role:QuestRole,_demo:boolean):[Store,(p:Store)=>void]{
 const g=useStartGuide(),[seenBy,setSeen]=useState<Record<string,string[]>>({});
 const save=useCallback((p:Store)=>{if(p.seenBy)setSeen(p.seenBy);const patch:any={};if(p.pings)patch.acknowledged=p.pings;if(p.mini!==undefined)patch.mini=p.mini;if(p.hideAll!==undefined)patch.hideAll=p.hideAll;if(Object.keys(patch).length)void g.client?.patch(patch)},[g.client]);
 return [{...g.data?.preferences,pings:g.data?.preferences.acknowledged||[],seenBy},save];
}
/** 보드·도움말에서 퀘스트 시작 */
export const startQuest=(role:QuestRole,id:string)=>{try{window.dispatchEvent(new CustomEvent('cc-quest-start',{detail:{role,id}}))}catch{}};
/** 하루 일과 등에서 짚기만 빌려 쓰기: 화면을 옮기고(page) 칸을 짚는다(steps). 마지막 단계를 누르면 끝난다 */
export const startGuide=(role:QuestRole,g:{id:string,emoji:string,title:string,page?:string,steps?:any[]})=>{try{window.dispatchEvent(new CustomEvent('cc-quest-start',{detail:{role,id:g.id,guide:g}}))}catch{}};
/** 기기·설정상 못 하는 퀘스트(needs 요소가 화면에 없음). 한 번이라도 보이면 계속 보인다 */
function useSkip(role:QuestRole){
 const found=useRef(new Set<string>()),present=found.current;
 const [skip,setSkip]=useState<string[]>([]);
 useEffect(()=>{if(!QUESTS[role].some(q=>q.needs))return;const check=()=>{const m:string[]=[];for(const q of QUESTS[role])if(q.needs){if(document.querySelector(q.needs))present.add(q.id);if(!present.has(q.id))m.push(q.id)}setSkip(o=>o.join()===m.join()?o:m)};const t=setTimeout(check,700),i=setInterval(check,2500);return()=>{clearTimeout(t);clearInterval(i)}},[role]);
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
const filled=(el:Element)=>{const i=el as HTMLInputElement,v=i.value;if(typeof v!=='string'||v.trim()==='')return false;return i.type==='number'?Number(v)>0:true};
/** 열려 있는 입력 창(사이드바 시트 제외) */
const openDialog=()=>[...document.querySelectorAll<HTMLElement>('[data-slot=dialog-content][data-state=open]')].pop()||null;

// ── 퀘스트 진행(모든 화면에 한 번 둔다) ──
export function QuestHost({role,state,branch,selfId='',demo=false,go}:{role:QuestRole,state:any,branch:string,selfId?:string,demo?:boolean,go?:(page:string)=>void}){
 const guide=useStartGuide(),restored=useRef(false);
 const [store,save]=useQuestStore(role,demo);
 const done=questDone(role,state,branch,selfId,store.pings||[]),skip=useSkip(role);
 const [active,setActive]=useState<Quest|null>(null),[idx,setIdx]=useState(0),[rect,setRect]=useState<DOMRect|null>(null),[lost,setLost]=useState<false|'lost'|'none'>(false),[altHint,setAltHint]=useState(''),[dialogEl,setDialogEl]=useState<HTMLElement|null>(null),startedAt=useRef(0);
 const [party,setParty]=useState<{q:Quest,prevXp:number}|null>(null),[toast,setToast]=useState<Quest|null>(null),[dlgOpen,setDlgOpen]=useState(false);
 // 축하는 입력 창(QR 창 등)이 닫힌 뒤에 띄운다(창이 열려 있으면 축하 버튼을 누를 수 없고, 누르면 창이 닫힘)
 useEffect(()=>{if(!party)return;const c=()=>setDlgOpen(!!openDialog());c();const t=setInterval(c,300);return()=>clearInterval(t)},[party]);
 const idxRef=useRef(0);idxRef.current=idx;
 // 초기 설정 창(SetupGate)이 퀘스트 중에는 비켜서도록 알린다
 useEffect(()=>{try{window.dispatchEvent(new CustomEvent('cc-quest-active',{detail:{role,id:active?.id||(party?'party':null)}}))}catch{}},[active,party,role]);
 const activeRef=useRef<Quest|null>(null);activeRef.current=active;
 useEffect(()=>{if(guide.status==='scope-changed'){setActive(null);setRect(null);setParty(null);setToast(null);restored.current=false}},[guide.status]);
 const pinged=useRef(new Set<string>());
 // 같은 표시를 여러 번 보내지 않고, 동시에 생긴 두 표시도 합쳐서 보낸다
 const ping=useCallback((id:string)=>{const p=guide.client?.getSnapshot().data?.preferences.acknowledged||[];if(p.includes(id)||pinged.current.has(id))return;pinged.current.add(id);save({pings:[...new Set([...p,...pinged.current])]})},[guide.client,save]);
 useEffect(()=>{restored.current=false;pinged.current.clear()},[guide.client]);
 useEffect(()=>{if(!guide.data||restored.current)return;restored.current=true;const a=guide.data.preferences.active;if(!a||a.questId==='tour')return;const q=QUESTS[role].find(q=>q.id===a.questId);
  // 이어 하기: 화면은 옮기지 않는다(알림·링크로 연 화면을 덮어쓰지 않게). 다른 화면이면 '돌아가기'가 나온다
  if(q&&!done[q.id]){startedAt.current=0;setActive(q);setIdx(0)}},[guide.data,role]);
 // 진행 중인 퀘스트는 시작할 때 한 번만 저장한다(단계마다 저장하면 서버에 부담)
 useEffect(()=>{if(!active||(active as any).guideOnly||!guide.data)return;const cur=guide.client?.getSnapshot().data?.preferences.active;if(cur?.questId===active.id)return;void guide.client?.patch({active:{questId:active.id,step:0}})},[active,guide.client,!!guide.data]);
 // 처음: 이미 끝난 퀘스트는 축하하지 않고 본 것으로
 const doneKey=Object.keys(done).filter(k=>done[k]).sort().join(',');
 const seenKey=role==='owner'?branch:selfId||'me';
 useEffect(()=>{
  if(!guide.data)return;
  const all=store.seenBy||{},seen=all[seenKey];
  if(!seen){save({seenBy:{...all,[seenKey]:doneKey?doneKey.split(','):[]}});return}// 이 지점·이 사람은 처음: 축하 없이 기억만
  const fresh=QUESTS[role].filter(q=>done[q.id]&&!seen.includes(q.id));if(!fresh.length)return;
  save({seenBy:{...all,[seenKey]:[...seen,...fresh.map(q=>q.id)]}});
  const xpNow=QUESTS[role].filter(q=>done[q.id]).reduce((n,q)=>n+q.xp,0);
  const mine=fresh.find(q=>q.id===activeRef.current?.id);
  if(mine){setActive(null);void guide.client?.patch({active:null});setRect(null);setParty({q:mine,prevXp:xpNow-fresh.reduce((n,q)=>n+q.xp,0)})}
  else if(!robot()){const last=fresh[fresh.length-1];setToast(fresh.length>1?{...last,title:fresh.map(q=>q.title).join(', '),xp:fresh.reduce((n,q)=>n+q.xp,0)} as Quest:last);setTimeout(()=>setToast(null),4200)}
 },[doneKey,seenKey,!!guide.data]);// eslint-disable-line
 // 기록에 안 남는 퀘스트: 화면에 보이면 완료
 useEffect(()=>{
  const left=QUESTS[role].filter(q=>q.doneSel&&!done[q.id]);if(!left.length)return;
  const t=setInterval(()=>{for(const q of left)if(q.doneSel!.some(f=>findEl(f)))ping(q.id)},800);
  return()=>clearInterval(t);
 },[role,doneKey,ping]);// eslint-disable-line
 // 보드에서 시작
 useEffect(()=>{const h=(e:Event)=>{const d=(e as CustomEvent).detail;if(d?.role!==role)return;const g=d.guide,q:Quest|undefined=g?{id:'guide:'+g.id,chapter:0,emoji:g.emoji,title:g.title,why:'',xp:0,minutes:1,badge:{emoji:'',name:''},page:g.page,steps:g.steps||[],guideOnly:true} as any:QUESTS[role].find(x=>x.id===d.id);if(!q)return;if(!q.steps.length){if(q.page&&go)go(q.page);return}
  if(g&&activeRef.current&&!(activeRef.current as any).guideOnly)void guide.client?.patch({active:null});
  setParty(null);setActive(q);setIdx(0);setLost(false);setAltHint('');startedAt.current=Date.now();if(q.page&&go)go(q.page)};addEventListener('cc-quest-start',h);return()=>removeEventListener('cc-quest-start',h)},[role,go,guide.client]);
 // 짚을 칸 따라가기
 useEffect(()=>{
  if(!active)return;let miss=0,off=0,fixed='',none=false,seen=false,endT:any=0,recheck:any=0;
  const tick=()=>{
   const q=active,n=q.steps.length;let i=idxRef.current;const els=q.steps.map((_,k)=>stepEl(q,k));
   if(!els[i]&&!(q.steps[i].alt&&q.steps[i].alt!.find.some(f=>findEl(f)))){let j=-1;for(let k=i+1;k<n;k++)if(els[k]){j=k;break}if(j<0)for(let k=i-1;k>=0;k--)if(els[k]){j=k;break}if(j>=0)i=j}
   if(els[i]&&q.steps[i].kind==='check'&&(els[i] as HTMLInputElement).checked&&i<n-1)i++;
   if(i!==idxRef.current){idxRef.current=i;setIdx(i)}
   // 입력 창이 열려 있으면 안내 막대를 창 안에 둔다(창 밖을 누르면 창이 닫히고, 창 밖은 누를 수 없음)
   const dl=openDialog();setDialogEl(o=>o===dl?o:dl);
   let el=els[i],alt='';
   if(!el&&q.steps[i].alt){for(const f of q.steps[i].alt!.find){const a=findEl(f);if(a){el=a;alt=q.steps[i].alt!.hint;break}}}
   setAltHint(alt);cur=el;
   // 대상이 화면 밖에 오래 있으면(창이 늘어나 밀림 등) 단계마다 한 번 더 가운데로
   if(el){const r=el.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight){if(++off===3&&fixed!==i+':'+alt){fixed=i+':'+alt;el.scrollIntoView({block:'center'})}}else off=0}
   // '지금 할 일이 없어요'는 대상이 나타나거나 화면을 옮길 때까지 그대로 둔다(벗어났어요로 바뀌며 반복되지 않게)
   // 한 번이라도 짚었던 뒤에 사라지면(다른 화면으로 감) '벗어났어요', 처음부터 없으면 '할 일이 없어요'
   if(el){miss=0;none=false;seen=true;setLost(false)}else{setRect(null);if(++miss>8){if(!none&&!seen&&Date.now()-startedAt.current<5000)none=true;setLost(none?'none':'lost')}}
  };
  // 칸 위치는 매 프레임 따라간다(스크롤·창 움직임에 바로 맞춤)
  let cur:HTMLElement|null=null,raf=0;const follow=()=>{if(cur&&cur.isConnected){const r=cur.getBoundingClientRect();setRect(o=>o&&o.top===r.top&&o.left===r.left&&o.width===r.width&&o.height===r.height?o:r)}raf=requestAnimationFrame(follow)};
  tick();const t=setInterval(tick,250);raf=requestAnimationFrame(follow);
  const owner=(target:EventTarget|null)=>{const q=active;if(!(target instanceof Node))return -1;for(let k=q.steps.length-1;k>=0;k--){const el=stepEl(q,k);if(el&&(el===target||el.contains(target)))return k}return -1};
  const advance=(k:number)=>{const n=active.steps.length;const to=Math.min(n-1,k+1);idxRef.current=to;setIdx(to)};
  const onClick=(e:Event)=>{const k=owner(e.target);if(k<0)return;const st=active.steps[k];if(st.kind==='click'){if(k===active.steps.length-1&&active.doneOnLastClick)ping(active.id);if(k===active.steps.length-1){if((active as any).guideOnly){const mine=active;endT=setTimeout(()=>{setActive(a=>a===mine?null:a);setRect(null)},600);return}
    // 마지막을 눌렀는데 2.5초가 지나도 안 끝나면(필수 칸을 빠뜨림) 빠진 칸으로 되돌린다
    clearTimeout(recheck);recheck=setTimeout(()=>{const q=active;for(let s2=0;s2<q.steps.length-1;s2++){const e2=stepEl(q,s2),st2=q.steps[s2];if(e2&&((st2.kind==='fill'&&!filled(e2))||(st2.kind==='check'&&!(e2 as HTMLInputElement).checked))){idxRef.current=s2;setIdx(s2);return}}},2500);return}advance(k)}else if(k>idxRef.current){idxRef.current=k;setIdx(k)}};
  const onFocus=(e:Event)=>{const k=owner(e.target);if(k>idxRef.current&&active.steps[k].kind!=='click'){idxRef.current=k;setIdx(k)}};
  const onChange=(e:Event)=>{const k=owner(e.target);if(k<0||k!==idxRef.current)return;const st=active.steps[k];if((st.kind==='fill'||st.kind==='pick')&&filled(e.target as Element))advance(k)};
  const onBlur=(e:Event)=>{const k=owner(e.target);if(k<0||k!==idxRef.current)return;const st=active.steps[k];if(st.kind==='pick'||(st.kind==='fill'&&filled(e.target as Element)))advance(k)};
  document.addEventListener('click',onClick,true);document.addEventListener('focusin',onFocus,true);document.addEventListener('change',onChange,true);document.addEventListener('focusout',onBlur,true);
  return()=>{clearInterval(t);cancelAnimationFrame(raf);clearTimeout(endT);clearTimeout(recheck);document.removeEventListener('click',onClick,true);document.removeEventListener('focusin',onFocus,true);document.removeEventListener('change',onChange,true);document.removeEventListener('focusout',onBlur,true)};
 },[active,ping]);
 // 단계가 바뀌면 칸이 화면 밖이면 가운데로
 useEffect(()=>{if(!active)return;const t=setTimeout(()=>{const el=stepEl(active,idx);if(!el)return;const r=el.getBoundingClientRect();if(r.top<70||r.bottom>innerHeight-90)el.scrollIntoView({block:'center',behavior:reduced()?'auto':'smooth'})},120);return()=>clearTimeout(t)},[active,idx]);
 const stop=()=>{setActive(null);setRect(null);void guide.client?.patch({active:null})};
 const xp=QUESTS[role].filter(q=>done[q.id]).reduce((n,q)=>n+q.xp,0);
 return <>
  {active&&<QuestPointer q={active} i={idx} rect={rect} hint={altHint}/>}
  {active&&(()=>{const kind=(active as any).guideOnly?'튜토리얼':'퀘스트',step=active.steps[idx];
   const msg=lost==='none'?(step?.none||'이 화면에는 지금 할 일이 없어요.'):lost==='lost'?(dialogEl?'입력 창을 닫으면 처음 단계부터 다시 짚어 드려요':`${kind} 화면을 벗어났어요`):`${idx+1}/${active.steps.length}단계${altHint?' · '+altHint:''}`;
   const hud=<div className={'qh-hud'+(dialogEl?' in-dialog':'')+(lost==='none'?' none':'')} role="status" aria-live="polite">
    <span className="qh-emoji" aria-hidden="true">{active.emoji}</span>
    <span className="qh-text"><b>{active.title}</b><small>{msg}</small><span className="sr-only">{lost||altHint?'':step?.hint}</span></span>
    {lost==='lost'&&!dialogEl&&active.page&&go&&<button type="button" className="qh-back" onClick={()=>{setLost(false);startedAt.current=Date.now();idxRef.current=0;setIdx(0);go(active.page!)}}>돌아가기</button>}
    <button type="button" className="qh-stop" onClick={stop} aria-label={kind+(lost==='none'?' 닫기':' 그만하기')}>{lost==='none'?'닫기':'그만'}</button>
   </div>;
   return dialogEl?createPortal(hud,dialogEl):hud})()}
  {party&&!dlgOpen&&<QuestParty skip={skip} role={role} q={party.q} prevXp={party.prevXp} xp={xp} done={done} demo={demo} onClose={()=>setParty(null)} onNext={q=>{setParty(null);startQuest(role,q.id)}}/>}
  {toast&&!party&&<div className="qh-toast" role="status"><span aria-hidden="true">{toast.badge.emoji}</span><span><b>퀘스트 완료 · {toast.title}</b><small>+{toast.xp} XP · 배지 「{toast.badge.name}」</small></span></div>}
 </>;
}

function QuestPointer({q,i,rect,hint}:{q:Quest,i:number,rect:DOMRect|null,hint?:string}){
 const bubble=useRef<HTMLDivElement>(null),[bh,setBh]=useState(70);
 useLayoutEffect(()=>{if(bubble.current)setBh(bubble.current.offsetHeight)},[i,rect?.width,hint]);
 if(!rect)return null;
 const vw=innerWidth,vh=innerHeight,pad=6,w=Math.min(300,vw-24);
 const ring={top:rect.top-pad,left:rect.left-pad,width:rect.width+pad*2,height:rect.height+pad*2};
 const below=rect.bottom+pad+14+bh<vh-8,left=Math.min(Math.max(12,rect.left+rect.width/2-w/2),vw-w-12);
 const top=Math.min(Math.max(8,below?rect.bottom+pad+12:rect.top-pad-12-bh),vh-bh-8);// 대상이 화면 끝에 있어도 말풍선은 화면 안에
 const arrow=Math.min(Math.max(16,rect.left+rect.width/2-left),w-16);
 const step=q.steps[i];
 return <div className="qp-root" aria-hidden="true">
  <div className="qp-ring" style={ring}/>
  <div ref={bubble} className={'qp-bubble'+(below?' below':' above')} style={{top,left,width:w,['--qp-arrow' as any]:arrow+'px'}}>
   <span className="qp-point">{hint?'👆 여기를 눌러요':step?.kind==='click'?'👆 여기를 눌러요':step?.kind==='check'?'☑️ 여기를 체크':step?.kind==='pick'?'👇 여기서 골라요':'✍️ 여기에 입력'}</span>
   <span className="qp-hint">{hint||step?.hint}</span>
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
 const card=useRef<HTMLDivElement>(null);
 useEffect(()=>{const prev=document.activeElement as HTMLElement|null;btn.current?.focus();const t=setTimeout(()=>setFill(after.pct),350);
  // Esc는 축하만 닫고(뒤 창까지 닫지 않게), Tab은 축하 창 안에서만 돈다. 닫으면 원래 자리로 초점을 돌려준다
  const k=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose()}else if(e.key==='Tab'&&card.current){const f=[...card.current.querySelectorAll<HTMLElement>('button')];if(!f.length)return;const a=f[0],z=f[f.length-1];if(!card.current.contains(document.activeElement)){e.preventDefault();a.focus()}else if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}}};
  addEventListener('keydown',k,true);return()=>{clearTimeout(t);removeEventListener('keydown',k,true);if(prev?.isConnected)prev.focus()}},[]);// eslint-disable-line
 return <div className="qc-root">
  <Confetti/>
  <div ref={card} className="qc-card" role="dialog" aria-modal="true" aria-labelledby="qc-title" aria-describedby="qc-desc">
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
 // 홈에는 한 줄만: 레벨·진행·다음 퀘스트 시작. '내일 할게요'로 숨기면 튜토리얼 메뉴에서 다시 연다.
 const guide=useStartGuide();
 const [store]=useQuestStore(role,demo);
 const skip=useSkip(role),done=questDone(role,state,branch,selfId,store.pings||[]),sum=questSummary(role,done,demo,skip),lv=sum.level;
 const who=role==='owner'?'사장님':'크루';
 if(!guide.data)return guide.error?<p className="start-guide-loading" role="status">시작 안내 연결을 기다리고 있어요. 업무는 바로 이용할 수 있어요.</p>:null;
 if(questHidden(guide.data.preferences))return null;
 const later=()=>void guide.client?.patch(sum.all?{hideAll:true}:{deferredUntil:new Date(Date.now()+86400000).toISOString()});
 const next=sum.next;
 return <section className={'qb-line'+(sum.all?' all':'')} aria-label={`${who} 퀘스트`}>
  <span className="qb-line-lv" aria-hidden="true">Lv.{lv.level}</span>
  <span className="qb-line-meta"><b>🎮 {who} 퀘스트 {sum.count}/{sum.list.length}</b><small>{sum.all?`모두 완료 · ${lv.title} 🏆`:`${lv.title} · 다음: ${next!.emoji} ${next!.title} (+${next!.xp} XP)`}</small><i className="qb-line-bar" aria-hidden="true"><i style={{width:Math.round(sum.count/sum.list.length*100)+'%'}}/></i></span>
  {next&&<button type="button" className="qb-line-go" onClick={()=>startQuest(role,next.id)}>▶ 퀘스트 시작</button>}
  <button type="button" className="qb-line-x" onClick={later}>{sum.all?'닫기':'내일 할게요'}</button>
 </section>;
}
/** 숨김·미루기 상태(튜토리얼 메뉴에서 다시 열기) */
export const questHidden=(p:any)=>!!p&&(p.hideAll||Date.parse(p.deferredUntil||'')>Date.now());
export function QuestReopen({onDone}:{onDone?:()=>void}){
 const guide=useStartGuide();
 if(!guide.data||!questHidden(guide.data.preferences))return null;
 return <button type="button" className="tut-tour" onClick={()=>{void guide.client?.patch({hideAll:false,mini:false,deferredUntil:null});onDone?.()}}>🎮 시작 퀘스트 다시 보기</button>;
}
