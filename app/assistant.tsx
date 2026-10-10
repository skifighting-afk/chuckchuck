'use client';
// 척척 비서(오른쪽 패널): 지금 화면에서 볼 것 + 가게 기록 분석 + 말로 시키기(확인 카드 → 실행).
// 대화형 AI를 부르지 않고 lib/assistant.ts 규칙으로 읽고 답한다.
import {useEffect,useMemo,useRef,useState} from 'react';
import {type Team,today} from '../lib/team-model';
import {assistantBrief,reply,KB,type Action,type Reply,type Memo} from '../lib/assistant';
import {type Target} from '../lib/close-check';
import {expandSlash,SLASH} from '../lib/improve2';
// 개선 2차 B150 대화 기록(이 기기·이 탭에만, 글만) · B156 잘못된 답 알리기 · B158 / 단축 명령 · B159 복사 · B160 지우기
const KEY='cc-ast-log';
const loadLog=():Msg[]=>{try{const v=JSON.parse(sessionStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.slice(-40).map((m:any,i:number)=>({id:-1000+i,from:m.from==='me'?'me':'bot',lines:(m.lines||[]).map(String).slice(0,30)})):[]}catch{return []}};

type Msg={id:number,from:'me'|'bot',lines:string[],actions?:Action[],done?:Record<number,string>,undo?:Record<number,(()=>Promise<string>)|null>,tone?:string};
type RunResult=string|{text:string,undo:()=>Promise<string>};
const CHIPS=['오늘 누가 일해?','누가 지각했어?','이번 달 인건비','분석해줘','명세서 다 보내줘','도움말'];
// 개선 2차 B146 화면별 추천 질문
const PAGE_CHIPS:Record<string,string[]>={'근무 스케줄':['이번 주 15시간 넘는 직원','내일 근무 누구야?','주 52시간 넘는 사람 있어?'],'출퇴근 기록':['누가 지각했어?','퇴근 안 찍은 사람','이번 달 지각 많은 직원 누구야?'],'급여·명세서':['이번 달 인건비','최저시급보다 적게 받는 직원 있어?','명세서 다 보내줘'],'휴가·공지':['대기 중인 휴가 신청 있어?','공지 안 읽은 사람'],'직원 관리':['보건증 끝나는 직원','계약서 안 쓴 직원'],'인건비 리포트':['분석해줘','지난달이랑 비교해줘'],'홈':['오늘 뭐부터 하면 돼?','오늘 누가 일해?']};
const PAGE_OF:Record<Target,string>={attendance:'출퇴근 기록',employees:'직원 관리',operations:'휴가·공지',contracts:'근로계약서',payroll:'급여·명세서',schedule:'근무 스케줄',reports:'인건비 리포트'};

export function AssistantDock({state,branch,page,run}:{state:Team,branch:string,page:string,run:(a:Action)=>Promise<RunResult>}){
 const [open,setOpen]=useState(false),[list,setList]=useState(false),[q,setQ]=useState(''),[msgs,setMsgs]=useState<Msg[]>(loadLog),[busy,setBusy]=useState(-1),faq=useRef<{q:string,a:string}[]>([]),log=useRef<HTMLDivElement>(null),seq=useRef(1),memo=useRef<Memo>({});
 const brief=useMemo(()=>assistantBrief(state,branch,page,today()).slice(0,4),[state,branch,page]);
 const urgent=brief.filter(b=>b.tone==='red'||b.tone==='amber').length;
 useEffect(()=>{try{sessionStorage.setItem(KEY,JSON.stringify(msgs.slice(-40).map(m=>({from:m.from,lines:m.lines}))))}catch{}},[msgs]);
 useEffect(()=>{log.current?.scrollTo({top:log.current.scrollHeight,behavior:'smooth'})},[msgs]);
 useEffect(()=>{if(!open)return;const k=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[open]);
 const ask=async(text:string)=>{const raw=text.trim();if(!raw)return;setQ('');const t=expandSlash(raw);
  if(!faq.current.length){try{const {FAQ}=await import('../lib/faq');faq.current=FAQ.flatMap(g=>g.items)}catch{}}
  const nd=t.match(/^(?:공지|공지사항)\s*[:：]\s*(.{2,})$/)||t.match(/^(.{2,}?)\s*(?:라고|이라고)?\s*공지\s*(?:해|써|올려|남겨)/);if(nd){try{sessionStorage.setItem('cc-notice-draft',nd[1].trim().slice(0,3000))}catch{}setMsgs(m=>[...m,{id:seq.current++,from:'me',lines:[raw]},{id:seq.current++,from:'bot',lines:['공지 초안을 만들었어요. 휴가·공지 화면의 새 공지 칸에 넣어 둘게요. 제목과 받는 사람을 확인하고 올려 주세요.',`내용: ${nd[1].trim().slice(0,200)}`],actions:[{type:'go',target:'operations',label:'공지 쓰러 가기'} as any],done:{}}]);return}
  const r:Reply=reply(t,state,branch,today(),Date.now(),faq.current,memo.current);memo.current=r.memo||{};
  // 개선 2차 B147: 답에 버튼이 없으면, 물어본 말에 맞는 화면을 '근거 보기'로 붙인다
  let acts=r.actions||[];if(!acts.length){const T:[RegExp,Target][]=[[/근무표|스케줄|대타|교대|15시간|52시간/,'schedule'],[/출근|퇴근|지각|결근|출퇴근/,'attendance'],[/급여|명세서|인건비|시급|공제|주휴/,'payroll'],[/휴가|연차|공지/,'operations'],[/계약/,'contracts'],[/직원|보건증|입사|퇴사/,'employees'],[/리포트|분석|비교/,'reports']];const hit=T.find(([re])=>re.test(t));if(hit&&PAGE_OF[hit[1]]!==page)acts=[{type:'go',target:hit[1],label:`근거 보기 · ${PAGE_OF[hit[1]]}`} as any]}
  setMsgs(m=>[...m,{id:seq.current++,from:'me',lines:[raw]},{id:seq.current++,from:'bot',lines:r.lines,actions:acts,done:{},tone:r.tone}]);
 };
 const act=async(m:Msg,i:number)=>{const a=m.actions![i];setBusy(m.id*100+i);try{const res=await run(a),text=typeof res==='string'?res:res.text,undo=typeof res==='string'?null:res.undo;setMsgs(list=>list.map(x=>x.id===m.id?{...x,done:{...x.done,[i]:text||'했어요.'},undo:{...x.undo,[i]:undo}}:x))}finally{setBusy(-1)}};
 const revert=async(m:Msg,i:number)=>{const u=m.undo?.[i];if(!u)return;setBusy(m.id*100+i);try{const t=await u();setMsgs(list=>list.map(x=>x.id===m.id?{...x,done:{...x.done,[i]:t},undo:{...x.undo,[i]:null}}:x))}finally{setBusy(-1)}};
 return <>
  <button type="button" className="ast-fab" aria-expanded={open} aria-controls="ast-dock" onClick={()=>setOpen(true)}><img src="/cheokcheoki-guide.png" alt="" width="36" height="36"/><span>척척 비서</span>{urgent>0&&<b aria-label={`확인할 것 ${urgent}건`}>{urgent}</b>}</button>
  <aside id="ast-dock" className={'ast-dock'+(open?' open':'')} aria-label="척척 비서">
   <header className="ast-head"><img src="/cheokcheoki-guide.png" alt="" width="44" height="44"/><div><b>척척 비서</b><small>가게 기록을 읽고 판단해 드려요</small></div>{msgs.length>0&&<button type="button" className="ast-close" onClick={()=>{if(confirm('비서 대화를 지울까요?')){setMsgs([]);try{sessionStorage.removeItem(KEY)}catch{}}}}>대화 지우기</button>}<button type="button" className="ast-close" aria-label="비서 숨기기" onClick={()=>setOpen(false)}>숨기기</button></header>
   <div className="ast-log" ref={log} aria-live="polite">
    <div className="ast-msg bot"><p className="ast-title">{page==='홈'?'오늘 가게':page} · 지금 볼 것</p><ul className="ast-brief">{brief.map((b,i)=><li key={i} className={b.tone||''}>{b.text}{b.target&&PAGE_OF[b.target]!==page&&<button type="button" onClick={()=>{run({type:'go',target:b.target!,label:''});setOpen(false)}}>{PAGE_OF[b.target]} 열기</button>}</li>)}</ul></div>
    {msgs.map(m=><div key={m.id} className={'ast-msg '+m.from+(m.tone?' '+m.tone:'')}>{m.lines.map((l,i)=><p key={i}>{l}</p>)}{m.from==='bot'&&<div className="ast-tools"><button type="button" className="link-btn ast-copy" onClick={()=>{void navigator.clipboard?.writeText(m.lines.join('\n'))}}>복사</button><a className="link-btn ast-copy" href={'/support?category='+encodeURIComponent('오류·문제')+'&body='+encodeURIComponent('척척 비서 답이 이상해요.\n\n물어본 것: '+(msgs[msgs.indexOf(m)-1]?.lines?.[0]||'')+'\n받은 답: '+m.lines.join(' / ').slice(0,600)+'\n\n어디가 틀렸는지: ')}>답이 이상해요</a></div>}{m.actions&&m.actions.length>0&&<div className="ast-acts">{m.actions.map((a,i)=>m.done?.[i]?<span key={i} className="ast-done" role="status">✓ {m.done[i]}{m.undo?.[i]&&<button type="button" className="ast-undo" disabled={busy>=0} onClick={()=>revert(m,i)}>되돌리기</button>}</span>:<button type="button" key={i} disabled={busy>=0} className={i===0?'primary':''} onClick={()=>act(m,i)}>{busy===m.id*100+i?'하는 중…':a.label}</button>)}</div>}</div>)}
   </div>
   {list&&<div className="ast-list" role="region" aria-label="물어볼 수 있는 것">{[...new Set(KB.map(k=>k.group))].map(g=><section key={g}><h3>{g}</h3>{KB.filter(k=>k.group===g).map(k=><button type="button" key={k.id} onClick={()=>{setList(false);ask(k.q)}}>{k.q}</button>)}</section>)}</div>}<div className="ast-chips"><button type="button" className="ast-all" aria-expanded={list} onClick={()=>setList(!list)}>{list?'목록 닫기':`물어볼 수 있는 것 ${KB.length}가지`}</button>{[...new Set([...(PAGE_CHIPS[page]||[]),...CHIPS])].slice(0,7).map(c=><button type="button" key={c} onClick={()=>ask(c)}>{c}</button>)}</div>
   <form className="ast-input" onSubmit={e=>{e.preventDefault();ask(q)}}><label htmlFor="ast-q" className="sr-only">척척 비서에게 말하기</label><input id="ast-q" value={q} onChange={e=>setQ(e.target.value)} placeholder="예: 김민지 내일 9시부터 6시 근무 · /근무 /급여" list="ast-slash" autoComplete="off"/><datalist id="ast-slash">{Object.keys(SLASH).map(k=><option key={k} value={k}>{SLASH[k]}</option>)}</datalist><VoiceButton onText={t=>{setQ(t);ask(t)}}/><button type="submit">보내기</button></form>
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
