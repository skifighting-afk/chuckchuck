'use client';
// 지시서 148: 장애·점검 공지 — 모든 화면 맨 위. 출근을 못 찍을 때 할 일을 함께 안내한다.
import {useEffect,useState} from 'react';
export function IncidentBanner({staff=false}:{staff?:boolean}){
 const [x,setX]=useState<any>(null);
 useEffect(()=>{let alive=true;const load=()=>fetch('/api/status').then(r=>r.json()).then((d:any)=>{if(alive)setX(d.incident||null)}).catch(()=>{});load();const t=setInterval(load,120000);return()=>{alive=false;clearInterval(t)}},[]);
 if(!x)return null;
 return <div className="incident-banner" role="alert"><b>{x.kind==='점검'?'🔧 점검 중':'⚠ 서비스 장애'} · {x.title}</b>{x.body&&<p>{x.body}</p>}<p className="incident-help">{staff?'출퇴근이 안 찍히면 지금 시각을 기억해 두세요. 인터넷이 끊긴 경우엔 휴대폰에 저장돼요. 복구되면 \'정정 요청\'으로 실제 시각을 보내 주세요.':'직원이 출퇴근을 못 찍으면 복구 뒤 출퇴근 기록의 \'직접 기록 추가\'로 실제 시각을 넣어 주세요.'}</p></div>;
}
export function IncidentAdmin(){
 const [kind,setKind]=useState('장애'),[title,setTitle]=useState(''),[body,setBody]=useState(''),[msg,setMsg]=useState(''),[cur,setCur]=useState<any>(null);
 const load=()=>fetch('/api/status').then(r=>r.json()).then((d:any)=>setCur(d.incident||null)).catch(()=>{});useEffect(()=>{load()},[]);
 const post=async(b:any)=>{setMsg('');const r=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const d:any=await r.json().catch(()=>({}));setMsg(r.ok?'반영했어요.':d.error||'처리하지 못했어요.');load()};
 return <section className="hq-panel" id="incident"><h2>장애·점검 공지</h2>{cur?<p><b>지금 띄우는 중:</b> [{cur.kind}] {cur.title} <button type="button" className="saas-secondary" onClick={()=>post({action:'incident',close:true})}>공지 닫기(복구됨)</button></p>:<p className="saas-fine">지금 띄운 공지가 없어요.</p>}
  <label className="saas-field">종류<select value={kind} onChange={e=>setKind(e.target.value)}><option>장애</option><option>점검</option></select></label><label className="saas-field">제목<input maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder="예: 출퇴근 기록이 늦게 저장돼요"/></label><label className="saas-field">내용<textarea maxLength={1000} value={body} onChange={e=>setBody(e.target.value)}/></label>
  <button type="button" className="saas-primary" disabled={!title.trim()} onClick={()=>post({action:'incident',kind,title,body})}>모든 화면에 띄우기</button>{msg&&<p role="status">{msg}</p>}</section>;
}
