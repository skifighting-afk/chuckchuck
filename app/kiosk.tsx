'use client';
// 지시서 020: 키오스크 모드 화면(/kiosk?k=…) — 매장 태블릿에 띄워 두고 이름 → 숫자 4~6자리 → 출근·퇴근
import {useEffect,useState} from 'react';
export function KioskPage(){
 const k=new URLSearchParams(location.search).get('k')||'',[v,setV]=useState<any>(null),[err,setErr]=useState(''),[sel,setSel]=useState<any>(null),[pin,setPin]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[now,setNow]=useState(Date.now());
 const load=()=>fetch('/api/kiosk?k='+encodeURIComponent(k)).then(async r=>{const d:any=await r.json();if(!r.ok)throw Error(d.error);setV(d);setErr('')}).catch(e=>setErr((e as Error).message||'불러오지 못했어요. 인터넷을 확인해 주세요.'));
 useEffect(()=>{void load();const a=setInterval(load,60000),b=setInterval(()=>setNow(Date.now()),15000);return ()=>{clearInterval(a);clearInterval(b)}},[]);
 useEffect(()=>{if(!msg)return;const t=setTimeout(()=>setMsg(''),4000);return ()=>clearTimeout(t)},[msg]);
 const go=async(kind?:string)=>{setBusy(true);setErr('');try{const r=await fetch('/api/kiosk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({k,employeeId:sel.id,pin,...(kind?{kind}:{})})});const d:any=await r.json();if(!r.ok)throw Error(d.error);setV(d);setMsg(d.ok);setSel(null);setPin('')}catch(e){setErr((e as Error).message);setPin('')}finally{setBusy(false)}};
 const time=new Date(now+9*3600000).toISOString().slice(11,16);
 if(!v)return <main className="kiosk"><p role={err?'alert':'status'}>{err||'불러오는 중…'}</p></main>;
 return <main className="kiosk"><header><h1>{v.store} · {v.branch}</h1><p className="kiosk-time">{time}</p></header>
  {msg&&<p className="kiosk-ok" role="status">✓ {msg}</p>}
  {!sel?<><p className="kiosk-help">내 이름을 눌러 주세요</p><ul className="kiosk-names">{v.staff.map((e:any)=><li key={e.id}><button type="button" onClick={()=>{setSel(e);setPin('');setErr('')}}><b>{e.name}</b><small>{e.working?(e.onBreak?'휴게 중':'근무 중'):e.shift?`오늘 ${e.shift}`:'오늘 근무 없음'}</small></button></li>)}</ul></>
  :<section className="kiosk-pin" aria-label={`${sel.name} 비밀번호`}><h2>{sel.name}님 · {sel.working?'퇴근':'출근'}</h2>{!sel.pin&&<p className="saas-error">아직 태블릿 비밀번호가 없어요. 내 휴대폰 앱의 '태블릿 출퇴근 비밀번호'에서 먼저 정해 주세요.</p>}
   <output aria-live="polite" className="kiosk-dots">{'●'.repeat(pin.length)||'숫자 4~6자리'}</output>
   <div className="kiosk-pad">{['1','2','3','4','5','6','7','8','9','지우기','0','확인'].map(x=><button type="button" key={x} disabled={busy||(x==='확인'&&pin.length<4)} onClick={()=>{if(x==='지우기')setPin(pin.slice(0,-1));else if(x==='확인')void go();else if(pin.length<6)setPin(pin+x)}}>{x}</button>)}</div>
   {sel.working&&<div className="kiosk-extra"><button type="button" disabled={busy||pin.length<4} onClick={()=>go(sel.onBreak?'resume':'break')}>{sel.onBreak?'휴게 끝':'휴게 시작'}</button></div>}
   <button type="button" className="kiosk-back" onClick={()=>{setSel(null);setPin('');setErr('')}}>← 이름 다시 고르기</button></section>}
  {err&&<p className="kiosk-err" role="alert">{err}</p>}
  <footer>척척사장 매장 태블릿 · 출퇴근만 할 수 있어요</footer></main>;
}
