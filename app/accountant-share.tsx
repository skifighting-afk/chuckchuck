// 가이드 68: 세무사 읽기 전용 링크(사장님 급여 화면) · 링크로 연 화면(/share)
import {useEffect,useState} from 'react';
const post=async(body:any)=>{const r=await fetch('/api/share',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d:any=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'처리하지 못했어요.');return d};
export function AccountantShare({runKey}:{runKey:string}){
 const [list,setList]=useState<any[]>([]),[link,setLink]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
 const load=()=>fetch('/api/share').then(r=>r.json()).then((d:any)=>setList((d.shares||[]).filter((s:any)=>s.runKey===runKey))).catch(()=>{});
 useEffect(()=>{load()},[runKey]);
 const make=async()=>{setBusy(true);setErr('');try{const d=await post({action:'create',runKey});setLink(d.url);await load()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}};
 return <section className="panel t-panelbody t-gap" aria-label="세무사 링크"><h3>세무사에게 링크로 보내기</h3><p className="footnote">확정한 이번 달 급여 자료를 읽기 전용 링크로 보내요. 7일 뒤 끝나고, 언제든 끌 수 있고, 열어 본 시각이 남아요.</p>
  <button type="button" className="secondary" disabled={busy} onClick={make}>{busy?'만드는 중…':'링크 만들기'}</button>
  {link&&<p className="notice">링크: <input readOnly value={link} onFocus={e=>e.target.select()} aria-label="세무사 링크" style={{width:'100%'}}/> <button type="button" className="secondary" onClick={()=>navigator.clipboard?.writeText(link).catch(()=>{})}>복사</button></p>}
  {err&&<p className="t-warn" role="alert">{err}</p>}
  {list.length>0&&<ul>{list.map(s=><li key={s.id}>{new Date(s.createdAt).toLocaleDateString('ko-KR')} 만든 링크 · {s.active?`${new Date(s.expiresAt).toLocaleDateString('ko-KR')}까지`:s.revoked?'꺼짐':'끝남'} · 열어 본 횟수 {s.views}번 {s.active&&<button type="button" className="secondary" onClick={async()=>{try{await post({action:'revoke',id:s.id});await load()}catch(e){setErr((e as Error).message)}}}>끄기</button>}</li>)}</ul>}
 </section>;
}
/** 지시서 097: 세무사 상시 열람 링크 — 확정된 모든 달을 읽기만(30·90·180일) */
export function AccountantAccess(){
 const [list,setList]=useState<any[]>([]),[link,setLink]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[days,setDays]=useState(90);
 const load=()=>fetch('/api/share').then(r=>r.json()).then((d:any)=>setList((d.shares||[]).filter((s:any)=>s.runKey==='all'))).catch(()=>{});
 useEffect(()=>{load()},[]);
 return <section className="panel t-panelbody t-gap" aria-label="세무사 상시 열람"><h3>세무사 상시 열람 링크</h3><p className="footnote">확정한 모든 달(최근 24개월)의 급여 자료를 세무사가 읽기만 할 수 있어요. 고치거나 직원 개인정보(연락처·주소)는 볼 수 없어요. 기간이 끝나면 저절로 꺼지고, 열어 본 시각이 남아요.</p>
  <div className="t-inline"><label>기간 <select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={30}>30일</option><option value={90}>90일</option><option value={180}>180일</option></select></label><button type="button" className="secondary" disabled={busy} onClick={async()=>{setBusy(true);setErr('');try{const d=await post({action:'create',runKey:'all',days});setLink(d.url);await load()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}}>{busy?'만드는 중…':'상시 링크 만들기'}</button></div>
  {link&&<p className="notice">링크: <input readOnly value={link} onFocus={e=>e.target.select()} aria-label="세무사 상시 링크" style={{width:'100%'}}/> <button type="button" className="secondary" onClick={()=>navigator.clipboard?.writeText(link).catch(()=>{})}>복사</button></p>}
  {err&&<p className="t-warn" role="alert">{err}</p>}
  {list.length>0&&<ul>{list.map(s=><li key={s.id}>{new Date(s.createdAt).toLocaleDateString('ko-KR')} 만든 링크 · {s.active?`${new Date(s.expiresAt).toLocaleDateString('ko-KR')}까지`:s.revoked?'꺼짐':'끝남'} · 열어 본 횟수 {s.views}번 {s.active&&<button type="button" className="secondary" onClick={async()=>{try{await post({action:'revoke',id:s.id});await load()}catch(e){setErr((e as Error).message)}}}>끄기</button>}</li>)}</ul>}
 </section>;
}
export function SharePage(){
 const t=new URLSearchParams(location.search).get('t')||'',[d,setD]=useState<any>(null),[err,setErr]=useState('');
 useEffect(()=>{fetch('/api/share?t='+encodeURIComponent(t)).then(async r=>{const j:any=await r.json();if(!r.ok)throw Error(j.error);setD(j)}).catch(e=>setErr((e as Error).message||'링크를 열지 못했어요.'))},[]);
 const download=async(key?:string,month?:string)=>{const r=await fetch('/api/share?format=csv&t='+encodeURIComponent(t)+(key?'&key='+encodeURIComponent(key):''));if(!r.ok){setErr('내려받지 못했어요. 링크가 끝났는지 확인해 주세요.');return}const b=await r.blob(),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`급여자료-${month||d.month}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000)};
 return <main className="saas-policy"><span className="saas-kicker">세무사용 읽기 전용 자료</span>{err?<><h1>링크를 열 수 없어요</h1><p className="saas-error" role="alert">{err}</p></>:!d?<p>불러오는 중…</p>:<>{d.runs?<><h1>{d.store} · 확정 급여 자료</h1><p>{new Date(d.expiresAt).toLocaleDateString('ko-KR')}까지 볼 수 있어요.</p><ul className="share-runs">{d.runs.map((r:any)=><li key={r.key}><b>{r.month}</b>{r.branch&&` · ${r.branch}`} · 지급일 {r.payDate} · {r.people}명 · 총지급 {Math.round(r.gross).toLocaleString('ko-KR')}원 <button type="button" className="saas-secondary" onClick={()=>download(r.key,r.month)}>CSV</button></li>)}{!d.runs.length&&<li>아직 확정한 급여가 없어요.</li>}</ul></>:<><h1>{d.store} · {d.month} 급여 자료</h1><p>지급일 {d.payDate} · {d.people}명 · {new Date(d.expiresAt).toLocaleDateString('ko-KR')}까지 볼 수 있어요.</p><button type="button" className="saas-primary" onClick={()=>download()}>CSV 내려받기</button><p className="saas-fine">이 링크는 사장님이 보낸 것으로, 열어 본 시각이 사장님께 남아요. 자료를 다른 곳에 공유하지 말아 주세요.</p></>}</>}</main>;
}
