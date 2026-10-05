'use client';
// 척척 비서(오른쪽 패널): 지금 화면에서 볼 것 + 가게 기록 분석 + 말로 시키기(확인 카드 → 실행).
// 대화형 AI를 부르지 않고 lib/assistant.ts 규칙으로 읽고 답한다.
import {useEffect,useMemo,useRef,useState} from 'react';
import {type Team,today} from '../lib/team-model';
import {assistantBrief,reply,type Action,type Reply} from '../lib/assistant';
import {type Target} from '../lib/close-check';

type Msg={id:number,from:'me'|'bot',lines:string[],actions?:Action[],done?:Record<number,string>,tone?:string};
const CHIPS=['오늘 누가 일해?','누가 지각했어?','이번 달 인건비','분석해줘','명세서 다 보내줘','도움말'];
const PAGE_OF:Record<Target,string>={attendance:'출퇴근 기록',employees:'직원 관리',operations:'휴가·공지',contracts:'근로계약서',payroll:'급여·명세서',schedule:'근무 스케줄',reports:'인건비 리포트'};

export function AssistantDock({state,branch,page,run}:{state:Team,branch:string,page:string,run:(a:Action)=>Promise<string>}){
 const [open,setOpen]=useState(false),[q,setQ]=useState(''),[msgs,setMsgs]=useState<Msg[]>([]),[busy,setBusy]=useState(-1),faq=useRef<{q:string,a:string}[]>([]),log=useRef<HTMLDivElement>(null),seq=useRef(1);
 const brief=useMemo(()=>assistantBrief(state,branch,page,today()).slice(0,4),[state,branch,page]);
 const urgent=brief.filter(b=>b.tone==='red'||b.tone==='amber').length;
 useEffect(()=>{log.current?.scrollTo({top:log.current.scrollHeight,behavior:'smooth'})},[msgs]);
 useEffect(()=>{if(!open)return;const k=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[open]);
 const ask=async(text:string)=>{const t=text.trim();if(!t)return;setQ('');
  if(!faq.current.length){try{const {FAQ}=await import('../lib/faq');faq.current=FAQ.flatMap(g=>g.items)}catch{}}
  const r:Reply=reply(t,state,branch,today(),Date.now(),faq.current);
  setMsgs(m=>[...m,{id:seq.current++,from:'me',lines:[t]},{id:seq.current++,from:'bot',lines:r.lines,actions:r.actions,done:{},tone:r.tone}]);
 };
 const act=async(m:Msg,i:number)=>{const a=m.actions![i];setBusy(m.id*100+i);try{const res=await run(a);setMsgs(list=>list.map(x=>x.id===m.id?{...x,done:{...x.done,[i]:res||'했어요.'}}:x))}finally{setBusy(-1)}};
 return <>
  <button type="button" className="ast-fab" aria-expanded={open} aria-controls="ast-dock" onClick={()=>setOpen(true)}><img src="/cheokcheoki-guide.png" alt="" width="36" height="36"/><span>척척 비서</span>{urgent>0&&<b aria-label={`확인할 것 ${urgent}건`}>{urgent}</b>}</button>
  <aside id="ast-dock" className={'ast-dock'+(open?' open':'')} aria-label="척척 비서">
   <header className="ast-head"><img src="/cheokcheoki-guide.png" alt="" width="44" height="44"/><div><b>척척 비서</b><small>가게 기록을 읽고 판단해 드려요</small></div><button type="button" className="ast-close" aria-label="비서 숨기기" onClick={()=>setOpen(false)}>숨기기</button></header>
   <div className="ast-log" ref={log} aria-live="polite">
    <div className="ast-msg bot"><p className="ast-title">{page==='홈'?'오늘 가게':page} · 지금 볼 것</p><ul className="ast-brief">{brief.map((b,i)=><li key={i} className={b.tone||''}>{b.text}{b.target&&PAGE_OF[b.target]!==page&&<button type="button" onClick={()=>{run({type:'go',target:b.target!,label:''});setOpen(false)}}>{PAGE_OF[b.target]} 열기</button>}</li>)}</ul></div>
    {msgs.map(m=><div key={m.id} className={'ast-msg '+m.from+(m.tone?' '+m.tone:'')}>{m.lines.map((l,i)=><p key={i}>{l}</p>)}{m.actions&&m.actions.length>0&&<div className="ast-acts">{m.actions.map((a,i)=>m.done?.[i]?<span key={i} className="ast-done" role="status">✓ {m.done[i]}</span>:<button type="button" key={i} disabled={busy>=0} className={i===0?'primary':''} onClick={()=>act(m,i)}>{busy===m.id*100+i?'하는 중…':a.label}</button>)}</div>}</div>)}
   </div>
   <div className="ast-chips">{CHIPS.map(c=><button type="button" key={c} onClick={()=>ask(c)}>{c}</button>)}</div>
   <form className="ast-input" onSubmit={e=>{e.preventDefault();ask(q)}}><label htmlFor="ast-q" className="sr-only">척척 비서에게 말하기</label><input id="ast-q" value={q} onChange={e=>setQ(e.target.value)} placeholder="예: 김민지 내일 9시부터 6시 근무" autoComplete="off"/><button type="submit">보내기</button></form>
  </aside>
  {open&&<div className="ast-scrim" onClick={()=>setOpen(false)} aria-hidden="true"/>}
 </>;
}
