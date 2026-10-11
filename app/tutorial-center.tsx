'use client';
// 튜토리얼 센터: 상단 "🎓 튜토리얼"을 누르면 하고 싶은 일을 고르고, 그 화면으로 옮겨 누를 곳을 짚어 준다.
// 지금 화면에서 할 수 있는 일을 먼저 보여 주고, 검색으로 찾을 수 있다. "화면 둘러보기"는 예전 단계 안내.
import {useEffect,useRef,useState} from 'react';
import {TUTORIALS,searchTutorials,type Tutorial} from '../lib/tutorials';
import {QUESTS} from '../lib/quests';
import {startGuide} from './quests';
import {startTour} from './tour';

type Role='owner'|'staff';
export function runTutorial(role:Role,t:Tutorial){
 if(t.href){location.assign(t.href);return}
 const q=t.from?QUESTS[role].find(x=>x.id===t.from):null;
 startGuide(role,{id:'tut-'+t.id,emoji:t.emoji,title:t.title,page:t.page||q?.page,steps:t.steps||q?.steps||[]});
}

export function TutorialButton({role,page}:{role:Role,page?:string}){
 const [open,setOpen]=useState(false),btn=useRef<HTMLButtonElement>(null);
 return <>
  <button ref={btn} type="button" className="tut-btn" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><span aria-hidden="true">🎓</span><span className="tut-btn-t">튜토리얼</span></button>
  {open&&<TutorialMenu role={role} page={page} onClose={()=>{setOpen(false);setTimeout(()=>btn.current?.focus(),0)}}/>}
 </>;
}

function TutorialMenu({role,page,onClose}:{role:Role,page?:string,onClose:()=>void}){
 const [q,setQ]=useState(''),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{input.current?.focus();const k=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onClose()}};addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[]);// eslint-disable-line
 const all=TUTORIALS[role],found=searchTutorials(all,q),here=q?[]:all.filter(t=>page&&t.page===page),rest=q?found:all.filter(t=>!here.includes(t));
 const pick=(t:Tutorial)=>{onClose();setTimeout(()=>runTutorial(role,t),60)};
 const item=(t:Tutorial)=><li key={t.id}><button type="button" className="tut-item" onClick={()=>pick(t)}><span className="tut-ic" aria-hidden="true">{t.emoji}</span><span className="tut-t">{t.title}</span><span className="tut-go" aria-hidden="true">{t.href?'열기 ↗':'따라 하기 ▶'}</span></button></li>;
 return <div className="tut-root" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div className="tut-card" role="dialog" aria-modal="true" aria-labelledby="tut-title">
   <div className="tut-head"><h2 id="tut-title">🎓 무엇을 도와드릴까요?</h2><button type="button" className="tut-x" onClick={onClose} aria-label="튜토리얼 닫기">✕</button></div>
   <p className="tut-lead">하고 싶은 일을 고르면 그 화면으로 옮겨서 <b>어디를 누르고 어디에 입력하는지</b> 하나씩 짚어 드려요.</p>
   <label className="tut-search"><span className="sr-only">튜토리얼 찾기</span><input ref={input} value={q} onChange={e=>setQ(e.target.value)} placeholder="예: 근무, 급여, 휴가, QR" enterKeyHint="search"/></label>
   {here.length>0&&<><h3>지금 화면에서</h3><ul className="tut-list">{here.map(item)}</ul></>}
   {(q||rest.length>0)&&<h3>{q?`찾은 튜토리얼 ${found.length}개`:here.length?'다른 일':'자주 찾는 일'}</h3>}
   {rest.length?<ul className="tut-list">{rest.map(item)}</ul>:q?<p className="tut-empty">찾는 튜토리얼이 없어요. <a href={'/help?q='+encodeURIComponent(q)}>도움말에서 찾아보기 →</a></p>:null}
   <div className="tut-foot"><button type="button" className="tut-tour" onClick={()=>{onClose();setTimeout(()=>startTour(role),60)}}>🧭 화면 전체 둘러보기</button><a href="/help">도움말 전체</a></div>
  </div>
 </div>;
}
