'use client';
// 작업 092: 이 기기에서 알림 받기(명세서 도착·계약 서명 요청·정정 결과·휴가 결과·대타 요청)
import {useEffect,useState} from 'react';
const dec=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4)),c=>c.charCodeAt(0));
export function PushToggle(){
 const [key,setKey]=useState<string|null|undefined>(undefined),[on,setOn]=useState(false),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 const supported=typeof window!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 useEffect(()=>{if(!supported)return;fetch('/api/push').then(r=>r.json()).then((d:any)=>setKey(d.publicKey||null)).catch(()=>setKey(null));navigator.serviceWorker.ready.then(r=>r.pushManager.getSubscription()).then(s=>setOn(!!s)).catch(()=>{})},[]);
 if(!supported||!key)return null;
 const post=(body:any)=>fetch('/api/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(async r=>{if(!r.ok)throw Error(((await r.json().catch(()=>({}))) as any).error||'저장하지 못했어요.')});
 async function enable(){setBusy(true);setMsg('');try{if(await Notification.requestPermission()!=='granted')throw Error('알림이 허용되지 않았어요. 휴대폰·브라우저 설정에서 이 사이트 알림을 허용해 주세요.');const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:dec(key!)});await post({action:'subscribe',subscription:sub.toJSON()});setOn(true);setMsg('이 기기에서 알림을 받아요.')}catch(e){setMsg((e as Error).message||'알림을 켜지 못했어요. 아이폰은 홈 화면에 추가한 앱에서만 알림을 받을 수 있어요.')}finally{setBusy(false)}}
 async function disable(){setBusy(true);setMsg('');try{const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub){await post({action:'unsubscribe',endpoint:sub.endpoint});await sub.unsubscribe()}setOn(false);setMsg('이 기기 알림을 껐어요.')}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}}
 return <div className="push-toggle"><button type="button" className="saas-secondary" disabled={busy} onClick={on?disable:enable}>{on?'이 기기 알림 끄기':'이 기기에서 알림 받기'}</button><small>명세서 도착, 계약서 서명 요청, 정정·휴가 결과, 대타 요청을 알려 드려요.{/iPhone|iPad/.test(navigator.userAgent)?' 아이폰은 홈 화면에 추가한 앱에서만 받을 수 있어요.':''}</small>{msg&&<p role="status">{msg}</p>}</div>
}
