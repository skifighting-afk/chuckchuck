'use client';
// 초기 설정(필수 온보딩): 처음 가입한 사장님은 3단계(가게 정보 → 첫 직원 → 첫 근무)를 끝내야 모든 메뉴가 열린다.
// - 단계마다 '시작'을 누르면 이 창이 잠시 비켜서고, 실제 화면에서 입력할 곳을 짚어 준다(QuestHost).
// - 퀘스트를 멈추면 다시 이 창이 덮는다. 다 끝내면 완료 표시를 가게 기록에 남겨 다시 뜨지 않는다.
// - 자동 점검 브라우저에서는 ?setup=1일 때만 뜬다(기존 점검 흐름 보호).
import {useEffect,useRef,useState} from 'react';
import {QUESTS,questDone} from '../lib/quests';
import {SETUP_STEPS,setupNeeded} from '../lib/tutorials';
import {startQuest} from './quests';
import {createPortal} from 'react-dom';
import {useInertOthers} from './overlay-utils';

export function SetupGate({state,branch,onDone}:{state:any,branch:string,onDone:()=>Promise<any>|void}){
 const done=questDone('owner',state,branch,'',[]);
 const robot=typeof navigator!=='undefined'&&!!(navigator as any).webdriver&&new URLSearchParams(location.search).get('setup')!=='1';
 const need=!robot&&setupNeeded(state,done);
 const [active,setActive]=useState(false),[finished,setFinished]=useState(false),[saving,setSaving]=useState(false),shown=useRef(false),card=useRef<HTMLDivElement>(null);
 useEffect(()=>{const h=(e:Event)=>{const d=(e as CustomEvent).detail;if(d?.role==='owner')setActive(!!d.id)};addEventListener('cc-quest-active',h);return()=>removeEventListener('cc-quest-active',h)},[]);
 // 입력 창(직원 등록 등)이 열려 있으면 그 위를 덮지 않는다(덮으면 창도 이 화면도 누를 수 없음)
 const [dialogOpen,setDialogOpen]=useState(false);
 const watch=need||finished;
 useEffect(()=>{if(!watch)return;const t=setInterval(()=>setDialogOpen(!!document.querySelector('[data-slot=dialog-content][data-state=open]')),400);return()=>clearInterval(t)},[watch]);
 if(need)shown.current=true;
 const allDone=SETUP_STEPS.every(k=>done[k]);
 // 다 끝나면 완료 표시를 바로 저장한다(창을 닫지 않고 새로고침해도, 나중에 직원·근무를 지워도 다시 잠기지 않게). 실패하면 다시 시도
 const doneAt=state?.settings?.more?.setupDoneAt,doneRef=useRef(onDone);doneRef.current=onDone;// 다시 시도할 때 최신 가게 기록으로 저장(옛 기록으로 덮어쓰지 않게)
 useEffect(()=>{if(!(shown.current&&allDone)||doneAt)return;setFinished(true);let stop=false,t:any;const run=async()=>{let ok:any=false;try{ok=await doneRef.current()}catch{}if(ok===false&&!stop)t=setTimeout(run,5000)};void run();return()=>{stop=true;clearTimeout(t)}},[allDone,!!doneAt]);// eslint-disable-line
 const open=(need||finished)&&!active&&!dialogOpen;
 useEffect(()=>{if(open)setTimeout(()=>card.current?.focus(),50)},[open]);
 useInertOthers(card,open);
 // 키보드: Tab이 이 창 밖(뒤 화면)으로 나가지 않게
 useEffect(()=>{if(!open)return;const k=(e:KeyboardEvent)=>{if(e.key!=='Tab'||!card.current)return;const f=[...card.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')];if(!f.length)return;const a=f[0],z=f[f.length-1],cur=document.activeElement;
  if(!card.current.contains(cur)){e.preventDefault();a.focus()}else if(e.shiftKey&&(cur===a||cur===card.current)){e.preventDefault();z.focus()}else if(!e.shiftKey&&cur===z){e.preventDefault();a.focus()}};addEventListener('keydown',k,true);return()=>removeEventListener('keydown',k,true)},[open]);
 if(!open)return null;
 const portal=(n:any)=>typeof document!=='undefined'?createPortal(n,document.body):n;
 const steps=SETUP_STEPS.map(id=>QUESTS.owner.find(q=>q.id===id)!),cur=steps.find(q=>!done[q.id]);
 const finish=async()=>{if(doneAt){setFinished(false);return}setSaving(true);let ok:any=false;try{ok=await onDone()}catch{}setSaving(false);if(ok!==false)setFinished(false)};
 return portal(<div className="sg-root">
  <div ref={card} className="sg-card" role="dialog" aria-modal="true" aria-labelledby="sg-title" tabIndex={-1}>
   {finished?<>
    <div className="sg-hero" aria-hidden="true">🎉</div>
    <h2 id="sg-title">초기 설정 끝! 이제 모든 메뉴가 열려요</h2>
    <p className="sg-lead">가게 정보, 첫 직원, 첫 근무까지 준비됐어요. 앞으로 모르는 게 있으면 위쪽 <b>🎓 튜토리얼</b>을 누르세요. 하고 싶은 일을 고르면 어디를 누르는지 짚어 드려요.</p>
    <button type="button" className="sg-go" disabled={saving} onClick={finish}>{saving?'저장 중…':'척척사장 시작하기 ▶'}</button>
   </>:<>
    <p className="sg-kicker">처음 한 번만 · 약 4분</p>
    <h2 id="sg-title">🚀 3단계만 하면 척척사장을 쓸 수 있어요</h2>
    <p className="sg-lead">단계마다 <b>어디를 누르고 어디에 입력하는지</b> 화면에서 하나씩 짚어 드려요. 다 끝내면 모든 메뉴가 열려요.</p>
    <ol className="sg-steps">{steps.map((q,i)=>{const d=!!done[q.id],now=q===cur;return <li key={q.id} className={d?'done':now?'now':'lock'}>
     <span className="sg-num" aria-hidden="true">{d?'✓':i+1}</span>
     <div className="sg-body"><b>{q.emoji} {q.title}</b><small>{d?'완료':now?q.why:'앞 단계를 끝내면 열려요'}</small>
      {now&&q.id==='staff'&&<small className="sg-alt">직원이 직접 가입하게 하려면 <a href="/staff-requests">가입 링크 보내기 →</a> 직원이 신청하면 그 화면에서 수락하면 이 단계가 끝나요.</small>}</div>
     {now&&<button type="button" className="sg-go" onClick={()=>startQuest('owner',q.id)}>{i===0?'▶ 시작':'▶ 이어서'}</button>}
     {!d&&!now&&<span className="sg-lock" aria-hidden="true">🔒</span>}
    </li>})}</ol>
    <p className="sg-foot"><a href="/demo">먼저 예시 화면 둘러보기</a> · <a href="/logout">로그아웃</a></p>
   </>}
  </div>
 </div>);
}
