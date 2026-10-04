'use client';
// 작업 057: 가게 대표(소유 계정) 넘기기 — 넘기는 쪽 요청(가게 이름·비밀번호) + 받는 쪽 수락(비밀번호)
import {useState} from 'react';
const post=async(body:any)=>{const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d:any=await r.json();if(!r.ok)throw Error(d.error||'처리하지 못했어요.');return d};
export function TransferOwner({a,storeName,reload}:{a:any,storeName:string,reload:()=>Promise<void>}){
 const [email,setEmail]=useState(''),[confirm,setConfirm]=useState(''),[pw,setPw]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[msg,setMsg]=useState('');
 const run=async(body:any,done:string)=>{setBusy(true);setErr('');setMsg('');try{await post(body);setPw('');await reload();setMsg(done)}catch(e){setErr((e as Error).message)}finally{setBusy(false)}};
 return <details className="auth-card t-gap transfer"><summary><b>가게 대표 넘기기</b></summary>
  {a.transfer?<><p><b>{a.transfer.toEmail}</b> 계정에 넘기는 중이에요. {new Date(a.transfer.expiresAt).toLocaleDateString('ko-KR')}까지 그 계정으로 로그인해 수락하면 넘어가요.</p><button className="saas-secondary" disabled={busy} onClick={()=>run({action:'transferCancel'},'대표 변경 요청을 취소했어요.')}>요청 취소</button></>:<>
  <p className="saas-fine">가게를 다른 사장님 계정으로 넘겨요. 직원·근무·급여·계약 기록이 모두 함께 넘어가고, 넘긴 뒤 지금 계정은 이 가게에 들어올 수 없어요. 이미 서명한 계약서의 사업주 이름은 바뀌지 않아요.</p>
  <label className="saas-field">넘겨받을 분의 이메일<input type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={200}/></label>
  <label className="saas-field">확인을 위해 가게 이름 입력 ({storeName})<input value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
  <label className="saas-field">현재 비밀번호<input type="password" autoComplete="current-password" value={pw} onChange={e=>setPw(e.target.value)} maxLength={128}/></label>
  <button className="saas-secondary" disabled={busy||!email.includes('@')||confirm!==storeName||!pw} onClick={()=>run({action:'transferStart',email,confirmName:confirm,password:pw},'요청했어요. 받는 분이 7일 안에 수락하면 넘어가요.')}>대표 변경 요청</button></>}
  {err&&<p className="saas-error" role="alert">{err}</p>}{msg&&<p className="saas-success" role="status">{msg}</p>}
 </details>
}
export function TransferOffers({offers}:{offers?:any[]}){
 const [pw,setPw]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 if(!offers?.length)return null;
 return <section className="auth-card transfer-offer" role="status"><h2>넘겨받을 가게가 있어요</h2>{offers.map(o=><div key={o.owner}><p><b>{o.storeName}</b> · {o.fromEmail}님이 대표를 넘기려고 해요({new Date(o.expiresAt).toLocaleDateString('ko-KR')}까지).</p><label className="saas-field">현재 비밀번호로 확인<input type="password" autoComplete="current-password" value={pw} onChange={e=>setPw(e.target.value)} maxLength={128}/></label><button className="saas-primary" disabled={busy||!pw} onClick={async()=>{setBusy(true);setErr('');try{await post({action:'transferAccept',owner:o.owner,password:pw});location.assign('/app')}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}}>수락하고 가게 대표 되기</button></div>)}{err&&<p className="saas-error" role="alert">{err}</p>}</section>
}
