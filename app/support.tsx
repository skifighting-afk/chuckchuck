// 가이드 97: 문의하기(회원) · 문의 답변(본사)
import {useEffect,useState} from 'react';
import {FAQ} from '../lib/faq';
import {suggestFaq,parseThread} from '../lib/faq-suggest';
const post=async(body:any)=>{const r=await fetch('/api/support',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d:any=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'처리하지 못했어요.');return d};
const when=(v?:string)=>v?new Date(v).toLocaleString('ko-KR',{dateStyle:'short',timeStyle:'short'}):'';
export function Support(){
 const [data,setData]=useState<any>(null),[category,setCategory]=useState('사용 방법'),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[err,setErr]=useState('');
 const load=()=>fetch('/api/support').then(r=>r.json()).then(setData).catch(()=>setErr('문의 목록을 불러오지 못했어요. 새로고침해 주세요.'));
 useEffect(()=>{load()},[]);
 const send=async()=>{setBusy(true);setErr('');setMsg('');try{await post({action:'create',category,body});setBody('');setMsg('문의를 남겼어요. 답변이 오면 알림(켜 둔 경우)과 이 화면으로 알려 드려요.');await load()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}};
 return <main className="saas-policy"><span className="saas-kicker">문의하기</span><h1>무엇을 도와드릴까요?</h1>
  <p>먼저 <a href="/help">자주 묻는 질문</a>을 보면 바로 해결될 수 있어요. 오류라면 화면에 나온 오류 번호(E-로 시작)를 함께 적어 주세요.</p>
  <section className="auth-card"><label className="saas-field" htmlFor="support-cat">문의 종류<select id="support-cat" value={category} onChange={e=>setCategory(e.target.value)}>{(data?.categories||['사용 방법']).map((c:string)=><option key={c}>{c}</option>)}</select></label>
   <label className="saas-field" htmlFor="support-body">내용<textarea id="support-body" rows={6} maxLength={3000} value={body} onChange={e=>setBody(e.target.value)} placeholder="어떤 화면에서 무엇을 하려다 어떻게 됐는지 적어 주세요. 직원 주민번호·계좌번호 같은 정보는 적지 마세요."/></label>
   {(()=>{const sug=suggestFaq(body,FAQ);return sug.length?<div className="faq-suggest" role="status"><b>이 답이 도움이 될 수 있어요</b>{sug.map(q=><details key={q.q}><summary>{q.q}</summary><p>{q.a}</p>{q.link&&<a href={q.link[0]}>{q.link[1]} →</a>}</details>)}</div>:null})()}
   <button type="button" className="saas-primary" disabled={busy||body.trim().length<5} onClick={send}>{busy?'보내는 중…':'문의 남기기'}</button>
   {msg&&<p className="saas-success" role="status">{msg}</p>}{err&&<p className="saas-error" role="alert">{err}</p>}</section>
  <h2>내 문의</h2>{data?.tickets?.length?<ul className="support-list">{data.tickets.map((t:any)=><li key={t.id}><p><b>[{t.category}]</b> {t.body}</p><small>{when(t.created_at)} · {t.status}</small><Thread t={t} reload={load}/></li>)}</ul>:<p>아직 남긴 문의가 없어요.</p>}
 </main>;
}
export function SupportDesk(){
 const [rows,setRows]=useState<any[]|null>(null),[reply,setReply]=useState<Record<string,string>>({}),[err,setErr]=useState('');
 const load=()=>fetch('/api/support?all=1').then(r=>r.json()).then((d:any)=>setRows(d.tickets||[])).catch(()=>setErr('문의를 불러오지 못했어요.'));
 useEffect(()=>{load()},[]);
 if(!rows)return null;
 const open=rows.filter(r=>r.status==='접수').length;
 return <section className="hq-panel" id="support"><h2>문의 {open?<b>답변 기다림 {open}건</b>:'· 모두 답변함'}</h2>{err&&<p className="saas-error">{err}</p>}
  <ul className="support-list">{rows.slice(0,50).map(t=><li key={t.id}><p><b>[{t.category}]</b> {t.store||'가게 없음'} · {t.role} · <small>{when(t.created_at)}</small></p><p>{t.body}</p>
   {parseThread(t.thread).map((m:any,i:number)=><div key={i} className={m.from==='본사'?'support-reply':'support-more'}><b>{m.from==='본사'?'보낸 답변':'추가 질문'}</b><p>{m.body}</p></div>)}{!parseThread(t.thread).length&&t.reply&&<div className="support-reply"><b>보낸 답변</b><p>{t.reply}</p></div>}{t.status!=='접수'?null:<div><textarea rows={3} maxLength={3000} aria-label="답변" value={reply[t.id]||''} onChange={e=>setReply({...reply,[t.id]:e.target.value})}/><button type="button" className="saas-secondary" disabled={!reply[t.id]?.trim()} onClick={async()=>{try{await post({action:'reply',id:t.id,reply:reply[t.id]});await load()}catch(e){setErr((e as Error).message)}}}>답변 보내기</button></div>}</li>)}</ul></section>;
}

/** 본사: 이메일로 임시 비밀번호 발급(사장님 비밀번호 찾기 요청 처리) */
export function PasswordDesk(){
 const [email,setEmail]=useState(''),[reason,setReason]=useState(''),[out,setOut]=useState(''),[err,setErr]=useState('');
 const run=async()=>{setErr('');setOut('');if(!confirm(email+' 계정의 비밀번호를 임시 비밀번호로 바꿀까요? 연락처로 본인 확인을 마쳤나요?'))return;try{const d=await post2({action:'resetByEmail',email,reason});setOut(`${d.name}님 임시 비밀번호: ${d.tempPassword}`)}catch(e){setErr((e as Error).message)}};
 return <section className="hq-panel" id="password"><h2>임시 비밀번호 발급</h2><p className="saas-fine">'비밀번호 찾기' 문의가 오면 적힌 번호로 전화해 가입 이메일·가게 이름이 맞는지 확인한 뒤 발급하세요. 발급 기록이 본사 접근 기록에 남아요.</p>
  <label className="saas-field">가입 이메일<input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="saas-field">확인한 내용(기록용)<input value={reason} maxLength={200} onChange={e=>setReason(e.target.value)} placeholder="예: 010-… 통화로 가게 이름 확인"/></label>
  <button type="button" className="saas-secondary" disabled={!email.includes('@')||!reason.trim()} onClick={run}>임시 비밀번호 만들기</button>{out&&<p className="saas-success" role="status">{out} — 전화로 알려 주고, 이 화면을 닫으면 다시 볼 수 없어요.</p>}{err&&<p className="saas-error" role="alert">{err}</p>}</section>;
}
const post2=async(body:any)=>{const r=await fetch('/api/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d:any=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'처리하지 못했어요.');return d};

/** 지시서 10주차: 문의 대화(답변·추가 질문)와 '해결됐어요' */
function Thread({t,reload}:{t:any,reload:()=>void}){
 const th=parseThread(t.thread),[more,setMore]=useState(''),[open,setOpen]=useState(false),[err,setErr]=useState('');
 const items=th.length?th:t.reply?[{from:'본사',body:t.reply,at:t.replied_at}]:[];
 const act=async(body:any)=>{setErr('');try{await post({...body,id:t.id});setMore('');setOpen(false);reload()}catch(e){setErr((e as Error).message)}};
 return <>{items.map((m:any,i:number)=><div key={i} className={m.from==='본사'?'support-reply':'support-more'}><b>{m.from==='본사'?'답변':'추가 질문'}</b><p>{m.body}</p><small>{when(m.at)}</small></div>)}
  {t.status==='답변 완료'&&<div className="support-actions"><button type="button" className="saas-secondary" onClick={()=>act({action:'resolve'})}>해결됐어요</button><button type="button" className="saas-secondary" aria-expanded={open} onClick={()=>setOpen(!open)}>추가로 묻기</button></div>}
  {open&&<div className="support-follow"><label className="saas-field">추가 질문<textarea rows={3} maxLength={3000} value={more} onChange={e=>setMore(e.target.value)}/></label><button type="button" className="saas-primary" disabled={more.trim().length<2} onClick={()=>act({action:'followup',body:more})}>보내기</button></div>}
  {err&&<p className="saas-error" role="alert">{err}</p>}</>;
}
