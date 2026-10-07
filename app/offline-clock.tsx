'use client';
// 지시서 149: 오프라인 출퇴근 임시 저장 — 기기에만 저장했다가 연결되면 '사장님 확인 요청'으로 보낸다(바로 기록하지 않음).
import {useEffect,useState} from 'react';
const KEY='chukchuk-offline-clock';
type Item={kind:'in'|'out',at:string};
const read=():Item[]=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return []}};
const write=(v:Item[])=>{try{localStorage.setItem(KEY,JSON.stringify(v.slice(-10)))}catch{}};
export function queueOffline(kind:'in'|'out'){write([...read(),{kind,at:new Date().toISOString()}])}
export function OfflineFlush({send}:{send:(b:any)=>Promise<boolean>}){
 const [n,setN]=useState(0);
 useEffect(()=>{let busy=false;const flush=async()=>{const q=read();setN(q.length);if(!q.length||busy||navigator.onLine===false)return;busy=true;const left:Item[]=[];for(const it of q){const ok=await send({action:'staffAsk',type:'clock',kind:it.kind,at:it.at,message:'인터넷이 끊겨 휴대폰에 저장해 둔 기록'}).catch(()=>false);if(!ok)left.push(it)}write(left);setN(left.length);busy=false};
  flush();addEventListener('online',flush);const t=setInterval(()=>setN(read().length),3000);return()=>{removeEventListener('online',flush);clearInterval(t)}},[]);
 return n?<p className="offline-note" role="status">휴대폰에 저장한 출퇴근 {n}건 · 인터넷이 연결되면 사장님께 보내요</p>:null;
}
