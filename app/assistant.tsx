'use client';
// 척척 비서(오른쪽 패널): 지금 화면에서 볼 것 + 가게 기록 분석 + 말로 시키기(확인 카드 → 실행).
// 대화형 AI를 부르지 않고 lib/assistant.ts 규칙으로 읽고 답한다.
import {useEffect,useMemo,useRef,useState} from 'react';
import {type Team,today} from '../lib/team-model';
import {assistantBrief,reply,KB,type Action,type Reply,type Memo} from '../lib/assistant';
import {type Target} from '../lib/close-check';

type Msg={id:number,from:'me'|'bot',lines:string[],actions?:Action[],done?:Record<number,string>,undo?:Record<number,(()=>Promise<string>)|null>,tone?:string};
type RunResult=string|{text:string,undo:()=>Promise<string>};
const CHIPS=['오늘 누가 일해?','누가 지각했어?','이번 달 인건비','분석해줘','명세서 다 보내줘','도움말'];
const PAGE_OF:Record<Target,string>={attendance:'출퇴근 기록',employees:'직원 관리',operations:'휴가·공지',contracts:'근로계약서',payroll:'급여·명세서',schedule:'근무 스케줄',reports:'인건비 리포트'};

export function AssistantDock({state,branch,page,run}:{state:Team,branch:string,page:string,run:(a:Action)=>Promise<RunResult>}){
 const [open,setOpen]=useState(false),[list,setList]=useState(false),[q,setQ]=useState(''),[msgs,setMsgs]=useState<Msg[]>([]),[busy,setBusy]=useState(-1),faq=useRef<{q:string,a:string}[]>([]),log=useRef<HTMLDivElement>(null),seq=useRef(1),memo=useRef<Memo>({});
 const brief=useMemo(()=>assistantBrief(state,branch,page,today()).slice(0,4),[state,branch,page]);
 const urgent=brief.filter(b=>b.tone==='red'||b.tone==='amber').length;
 useEffect(()=>{log.current?.scrollTo({top:log.current.scrollHeight,behavior:'smooth'})},[msgs]);
 useEffect(()=>{if(!open)return;const k=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[open]);
 const ask=async(text:string)=>{const t=text.trim();if(!t)return;setQ('');
  if(!faq.current.length){try{const {FAQ}=await import('../lib/faq');faq.current=FAQ.flatMap(g=>g.items)}catch{}}
  const r:Reply=reply(t,state,branch,today(),Date.now(),faq.current,memo.current);memo.current=r.memo||{};
  setMsgs(m=>[...m,{id:seq.current++,from:'me',lines:[t]},{id:seq.current++,from:'bot',lines:r.lines,actions:r.actions,done:{},tone:r.tone}]);
 };
 const act=async(m:Msg,i:number)=>{const a=m.actions![i];setBusy(m.id*100+i);try{const res=await run(a),text=typeof res==='string'?res:res.text,undo=typeof res==='string'?null:res.undo;setMsgs(list=>list.map(x=>x.id===m.id?{...x,done:{...x.done,[i]:text||'했어요.'},undo:{...x.undo,[i]:undo}}:x))}finally{setBusy(-1)}};
 const revert=async(m:Msg,i:number)=>{const u=m.undo?.[i];if(!u)return;setBusy(m.id*100+i);try{const t=await u();setMsgs(list=>list.map(x=>x.id===m.id?{...x,done:{...x.done,[i]:t},undo:{...x.undo,[i]:null}}:x))}finally{setBusy(-1)}};
 return <>
  <button type="button" className="ast-fab" aria-expanded={open} aria-controls="ast-dock" onClick={()=>setOpen(true)}><img src="/cheokcheoki-guide.png" alt="" width="36" height="36"/><span>척척 비서</span>{urgent>0&&<b aria-label={`확인할 것 ${urgent}건`}>{urgent}</b>}</button>
  <aside id="ast-dock" className={'ast-dock'+(open?' open':'')} aria-label="척척 비서">
   <header className="ast-head"><img src="/cheokcheoki-guide.png" alt="" width="44" height="44"/><div><b>척척 비서</b><small>가게 기록을 읽고 판단해 드려요</small></div><button type="button" className="ast-close" aria-label="비서 숨기기" onClick={()=>setOpen(false)}>숨기기</button></header>
   <div className="ast-log" ref={log} aria-live="polite">
    <div className="ast-msg bot"><p className="ast-title">{page==='홈'?'오늘 가게':page} · 지금 볼 것</p><ul className="ast-brief">{brief.map((b,i)=><li key={i} className={b.tone||''}>{b.text}{b.target&&PAGE_OF[b.target]!==page&&<button type="button" onClick={()=>{run({type:'go',target:b.target!,label:''});setOpen(false)}}>{PAGE_OF[b.target]} 열기</button>}</li>)}</ul></div>
    {msgs.map(m=><div key={m.id} className={'ast-msg '+m.from+(m.tone?' '+m.tone:'')}>{m.lines.map((l,i)=><p key={i}>{l}</p>)}{m.actions&&m.actions.length>0&&<div className="ast-acts">{m.actions.map((a,i)=>m.done?.[i]?<span key={i} className="ast-done" role="status">✓ {m.done[i]}{m.undo?.[i]&&<button type="button" className="ast-undo" disabled={busy>=0} onClick={()=>revert(m,i)}>되돌리기</button>}</span>:<button type="button" key={i} disabled={busy>=0} className={i===0?'primary':''} onClick={()=>act(m,i)}>{busy===m.id*100+i?'하는 중…':a.label}</button>)}</div>}</div>)}
   </div>
   {list&&<div className="ast-list" role="region" aria-label="물어볼 수 있는 것">{[...new Set(KB.map(k=>k.group))].map(g=><section key={g}><h3>{g}</h3>{KB.filter(k=>k.group===g).map(k=><button type="button" key={k.id} onClick={()=>{setList(false);ask(k.q)}}>{k.q}</button>)}</section>)}</div>}<div className="ast-chips"><button type="button" className="ast-all" aria-expanded={list} onClick={()=>setList(!list)}>{list?'목록 닫기':`물어볼 수 있는 것 ${KB.length}가지`}</button>{CHIPS.map(c=><button type="button" key={c} onClick={()=>ask(c)}>{c}</button>)}</div>
   <form className="ast-input" onSubmit={e=>{e.preventDefault();ask(q)}}><label htmlFor="ast-q" className="sr-only">척척 비서에게 말하기</label><input id="ast-q" value={q} onChange={e=>setQ(e.target.value)} placeholder="예: 김민지 내일 9시부터 6시 근무" autoComplete="off"/><VoiceButton onText={t=>{setQ(t);ask(t)}}/><button type="submit">보내기</button></form>
  </aside>
  {open&&<div className="ast-scrim" onClick={()=>setOpen(false)} aria-hidden="true"/>}
 </>;
}

/** 지시서 083: 말로 시키기 — 휴대폰·크롬의 음성 인식(지원하는 브라우저에서만 버튼이 보여요). 말한 내용은 글로 바뀌어 위 칸에 들어가요. */
function VoiceButton({onText}:{onText:(t:string)=>void}){
 const SR=typeof window!=='undefined'?((window as any).SpeechRecognition||(window as any).webkitSpeechRecognition):null;
 const [on,setOn]=useState(false),[err,setErr]=useState('');
 if(!SR)return null;
 const start=()=>{setErr('');try{const r=new SR();r.lang='ko-KR';r.interimResults=false;r.maxAlternatives=1;r.onresult=(e:any)=>{const t=e.results?.[0]?.[0]?.transcript||'';if(t.trim())onText(t.trim())};r.onerror=(e:any)=>setErr(e.error==='not-allowed'?'마이크 권한을 허용해 주세요.':'잘 못 들었어요. 다시 눌러 말해 주세요.');r.onend=()=>setOn(false);r.start();setOn(true)}catch{setErr('음성 인식을 시작하지 못했어요. 글로 적어 주세요.');setOn(false)}};
 return <><button type="button" className={'ast-mic'+(on?' on':'')} aria-pressed={on} onClick={start} disabled={on}>{on?'듣는 중…':<><span aria-hidden="true">🎤 </span>말하기</>}</button>{err&&<span role="status" className="ast-mic-err">{err}</span>}</>;
}
