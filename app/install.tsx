'use client';
// 작업 091: 서비스워커 등록과 '홈 화면에 추가' 안내
import {useEffect,useState} from 'react';
let deferred:any=null;const listeners=new Set<()=>void>();
export function registerSW(){
 if(typeof window==='undefined'||!('serviceWorker' in navigator))return;
 window.addEventListener('beforeinstallprompt',(e:any)=>{e.preventDefault();deferred=e;listeners.forEach(f=>f())});
 window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
}
const standalone=()=>typeof window!=='undefined'&&(matchMedia('(display-mode: standalone)').matches||(navigator as any).standalone===true);
const ios=()=>typeof navigator!=='undefined'&&/iPhone|iPad|iPod/.test(navigator.userAgent);
export function InstallButton(){
 const [ready,setReady]=useState(!!deferred),[tip,setTip]=useState(false);
 useEffect(()=>{const f=()=>setReady(!!deferred);listeners.add(f);return()=>{listeners.delete(f)}},[]);
 if(standalone())return null;
 if(ready)return <button type="button" className="text-size-toggle" onClick={async()=>{const d=deferred;deferred=null;setReady(false);d.prompt();await d.userChoice.catch(()=>null)}}>앱 설치</button>;
 if(ios())return <><button type="button" className="text-size-toggle" onClick={()=>setTip(!tip)}>앱 설치</button>{tip&&<div className="install-tip" role="dialog" aria-label="홈 화면에 추가 방법"><p>Safari 아래 <b>공유 버튼</b>(□↑)을 누르고 <b>홈 화면에 추가</b>를 고르면 앱처럼 열 수 있어요.</p><button className="saas-secondary" onClick={()=>setTip(false)}>닫기</button></div>}</>;
 return null;
}
