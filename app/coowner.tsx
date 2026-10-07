'use client';
// 지시서 108 여러 가게 전환 · 145 공동 관리자(가족·동업자)
import {useEffect,useState} from 'react';
const post=async(b:any)=>{const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const d:any=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'처리하지 못했어요. 다시 시도해 주세요.');return d};
export function StoreSwitcher({stores,current}:{stores?:any[],current?:string|null}){
 const [busy,setBusy]=useState(false);if(!stores||stores.length<2)return null;
 const label=(a:string)=>a==='owner'?'내 가게':a==='coowner'?'공동 관리':'직원';
 return <div className="store-switch"><label>보고 있는 가게 <select value={current||''} disabled={busy} onChange={async e=>{setBusy(true);try{await post({action:'switchStore',owner:e.target.value});location.assign('/app')}catch(err){alert((err as Error).message);setBusy(false)}}}>{stores.map(s=><option key={s.owner} value={s.owner}>{s.name} · {label(s.access)}</option>)}</select></label></div>;
}
export function CoownerAccept(){
 const token=new URLSearchParams(location.search).get('token')||'',[msg,setMsg]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
 return <main className="auth-card"><h1>공동 관리자 초대</h1><p>가게 대표님이 함께 관리하자고 초대했어요. 수락하면 이 계정으로 그 가게의 직원·근무표·급여를 사장님처럼 관리할 수 있어요. 요금제와 대표 변경은 대표님만 할 수 있어요.</p>
  {msg?<><p className="saas-success" role="status">{msg}</p><a className="saas-primary" href="/app">가게로 가기</a></>:<button className="saas-primary" disabled={busy||!token} onClick={async()=>{setBusy(true);setErr('');try{const d=await post({action:'acceptCoowner',token});setMsg(d.message)}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}}>수락하기</button>}
  {err&&<p className="saas-error" role="alert">{err}</p>}</main>;
}
export function CoownerPanel({data,reload}:{data:any,reload:()=>Promise<void>}){
 const [url,setUrl]=useState(''),[err,setErr]=useState('');
 if(!data?.coowners)return null;
 return <section className="auth-card t-gap" aria-label="공동 관리자"><h2>공동 관리자(가족·동업자)</h2><p className="saas-fine">공동 관리자는 자기 계정으로 들어와 이 가게를 사장님처럼 관리해요. 요금제·대표 변경·공동 관리자 초대는 대표 계정만 할 수 있어요. 최대 5명.</p>
  {data.coowners.length?<ul className="coowner-list">{data.coowners.map((c:any)=><li key={c.userId}><b>{c.name||c.email}</b> {c.email} · {String(c.addedAt).slice(0,10)}부터<button type="button" className="saas-secondary" onClick={async()=>{if(!confirm((c.name||c.email)+'님을 공동 관리자에서 내보낼까요?'))return;try{await post({action:'removeCoowner',userId:c.userId});await reload()}catch(e){setErr((e as Error).message)}}}>내보내기</button></li>)}</ul>:<p>아직 공동 관리자가 없어요.</p>}
  <button type="button" className="saas-secondary" onClick={async()=>{setErr('');try{const d=await post({action:'coownerInvite'});setUrl(d.url)}catch(e){setErr((e as Error).message)}}}>초대 링크 만들기</button>
  {url&&<div className="notice"><p>이 링크를 함께 관리할 분에게 보내 주세요. 7일 동안 한 번 쓸 수 있어요.</p><input readOnly value={url} onFocus={e=>e.currentTarget.select()} aria-label="초대 링크"/><button type="button" className="saas-secondary" onClick={()=>navigator.clipboard?.writeText(url)}>복사</button></div>}
  {err&&<p className="saas-error" role="alert">{err}</p>}</section>;
}
