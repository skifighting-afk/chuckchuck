'use client';
// 지시서 098: 2단계 인증 화면 — 켜기(인증 앱 QR) · 로그인할 때 6자리 · 끄기
import {useEffect,useState} from 'react';
import QRCode from 'qrcode';
const post=async(b:any)=>{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const d:any=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'처리하지 못했어요. 다시 시도해 주세요.');return d};

/** 로그인 뒤(또는 새로고침 뒤) 6자리를 묻는다 */
export function MfaPrompt({onDone}:{onDone:()=>void}){
 const [code,setCode]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[backup,setBackup]=useState(false);
 return <main className="native-auth-wrap"><section className="auth-card mfa-card"><h1>2단계 인증</h1><p>{backup?'비상 코드 하나를 넣어 주세요. 한 번 쓴 코드는 다시 못 써요.':'휴대폰 인증 앱(구글 OTP 등)에 보이는 6자리를 넣어 주세요.'}</p>
  <form onSubmit={async e=>{e.preventDefault();setBusy(true);setErr('');try{await post({action:'totpVerify',otp:code});onDone()}catch(x){setErr((x as Error).message);setCode('')}finally{setBusy(false)}}}>
   <input className="mfa-input" aria-label={backup?'비상 코드':'인증 코드 6자리'} inputMode={backup?'text':'numeric'} autoComplete="one-time-code" maxLength={backup?12:6} value={code} onChange={e=>setCode(backup?e.target.value.toUpperCase():e.target.value.replace(/\D/g,''))} autoFocus/>
   <button type="submit" className="saas-primary" disabled={busy||code.length<6}>{busy?'확인 중…':'확인'}</button></form>
  {err&&<p className="saas-error" role="alert">{err}</p>}
  <button type="button" className="auth-text-button" onClick={()=>{setBackup(!backup);setCode('');setErr('')}}>{backup?'인증 앱 코드 넣기':'휴대폰을 잃어버렸어요(비상 코드)'}</button>
  <a href="/logout" className="auth-text-button">다른 계정으로 로그인</a></section></main>;
}

/** 내 계정 화면: 2단계 인증 켜고 끄기 */
export function TotpPanel(){
 const [st,setSt]=useState<any>(null),[setup,setSetup]=useState<{secret:string,uri:string,qr:string}|null>(null),[code,setCode]=useState(''),[codes,setCodes]=useState<string[]|null>(null),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
 const load=()=>post({action:'totpStatus'}).then(setSt).catch(e=>setErr(e.message));
 useEffect(()=>{void load()},[]);
 const run=async(f:()=>Promise<void>)=>{setBusy(true);setErr('');try{await f()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}};
 return <section className="panel devices totp-panel" style={{padding:20,marginTop:16}}><h3>2단계 인증 {st?.enabled?'· 켜짐':''}</h3>
  <p className="footnote">비밀번호가 새도 휴대폰 인증 앱의 6자리가 없으면 들어올 수 없어요. 급여·직원 정보를 지키려면 켜 두기를 권해요.</p>
  {codes&&<div className="notice"><b>비상 코드 10개 — 지금 한 번만 보여요.</b> 휴대폰을 잃어버렸을 때 하나씩 쓸 수 있어요. 적어 두거나 사진으로 남겨 안전한 곳에 보관하세요.<ul className="mfa-codes">{codes.map(c=><li key={c}><code>{c}</code></li>)}</ul></div>}
  {st&&!st.enabled&&!setup&&<button type="button" className="saas-secondary" disabled={busy} onClick={()=>run(async()=>{const d=await post({action:'totpSetup'});setSetup({...d,qr:await QRCode.toDataURL(d.uri,{width:240,margin:2})})})}>2단계 인증 켜기</button>}
  {setup&&!st?.enabled&&<div className="mfa-setup"><p>1. 구글 OTP·마이크로소프트 인증 앱 같은 인증 앱을 열고 이 QR을 찍어 주세요.</p><img src={setup.qr} alt="인증 앱에 등록할 QR 코드" width={200} height={200}/><p className="footnote">QR을 못 찍으면 이 글자를 직접 넣어요: <code>{setup.secret.replace(/(.{4})/g,'$1 ').trim()}</code></p>
   <p>2. 인증 앱에 나온 6자리를 넣어 주세요.</p><form className="t-inline" onSubmit={e=>{e.preventDefault();void run(async()=>{const d=await post({action:'totpEnable',otp:code});setCodes(d.backupCodes);setSetup(null);setCode('');await load()})}}><input className="mfa-input" aria-label="인증 코드 6자리" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/><button type="submit" className="saas-primary" disabled={busy||code.length!==6}>켜기</button></form></div>}
  {st?.enabled&&<><p>비상 코드 {st.backupLeft}개 남음.</p><form className="t-inline" onSubmit={e=>{e.preventDefault();if(!confirm('2단계 인증을 끌까요? 비밀번호만으로 로그인하게 돼요.'))return;void run(async()=>{await post({action:'totpDisable',otp:code});setCode('');setCodes(null);await load()})}}><input className="mfa-input" aria-label="끄려면 인증 코드" inputMode="numeric" maxLength={12} placeholder="지금 6자리" value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/><button type="submit" className="saas-secondary" disabled={busy||code.length<6}>끄기</button></form></>}
  {err&&<p className="saas-error" role="alert">{err}</p>}</section>;
}
