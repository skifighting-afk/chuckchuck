'use client';
// 작업 044: 매장 태블릿·PC에 띄우는 30초마다 바뀌는 출퇴근 QR
import {useEffect,useState} from 'react';
import QRCode from 'qrcode';
/** 지시서 102: QR이 안 될 때 직원이 넣는 매장 코드 6자리(1분마다 바뀜) */
export function StoreCode({branch}:{branch:string}){
 const [c,setC]=useState<{code:string,expiresIn:number}|null>(null),[err,setErr]=useState('');
 useEffect(()=>{let alive=true,t:any=0;const load=async()=>{try{const r=await fetch('/api/qr-live?code=1&branch='+encodeURIComponent(branch)),d:any=await r.json();if(!r.ok)throw Error(d.error);if(!alive)return;setC(d);setErr('');t=setTimeout(load,Math.max(1,d.expiresIn)*1000+300)}catch(e){if(alive){setErr((e as Error).message);t=setTimeout(load,15000)}}};load();return()=>{alive=false;clearTimeout(t)}},[branch]);
 return <p className="store-code-show" aria-live="polite">{err?<small>{err}</small>:c?<>QR이 안 되면 매장 코드 <b>{c.code.slice(0,3)} {c.code.slice(3)}</b> <small>1분마다 바뀌어요</small></>:'매장 코드 준비 중…'}</p>;
}
export function LiveQr({branch,name,onClose}:{branch:string,name:string,onClose:()=>void}){
 const [img,setImg]=useState(''),[left,setLeft]=useState(0),[error,setError]=useState('');
 useEffect(()=>{let alive=true,timer:any=0,tick:any=0;
  const load=async()=>{try{const r=await fetch('/api/qr-live?branch='+encodeURIComponent(branch)),d:any=await r.json();if(!r.ok)throw Error(d.error);if(!alive)return;setImg(await QRCode.toDataURL(d.url,{width:480,margin:2}));setLeft(d.expiresIn);setError('');timer=setTimeout(load,Math.max(1,d.expiresIn)*1000+300)}catch(e){if(!alive)return;setError((e as Error).message||'QR을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');timer=setTimeout(load,5000)}};
  load();tick=setInterval(()=>setLeft(v=>Math.max(0,v-1)),1000);
  try{(navigator as any).wakeLock?.request('screen').catch(()=>{})}catch{}
  return()=>{alive=false;clearTimeout(timer);clearInterval(tick)}},[branch]);
 return <div className="live-qr" role="dialog" aria-label={name+' 출퇴근 QR'}><h2>{name} 출퇴근</h2>{error?<p className="saas-error" role="alert">{error}</p>:img?<img src={img} alt="30초마다 바뀌는 출퇴근 QR코드"/>:<p>QR을 만드는 중…</p>}<p className="live-qr-left" aria-live="polite">{left}초 뒤 새 QR</p><StoreCode branch={branch}/><p className="footnote">출근·퇴근 때 휴대폰 카메라로 찍고 1분 안에 기록하세요. 사진으로 찍어 둔 QR은 쓸 수 없어요.</p><button className="saas-secondary" onClick={onClose}>닫기</button></div>
}
