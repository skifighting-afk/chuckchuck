'use client';
// 지시서 2주차 131·132: 알림 모아보기(지난 알림 한곳에)와 받을 알림 고르기. 실제 매장은 /api/notifications, 체험은 예시.
import {useEffect,useRef,useState} from 'react';
import {Bell} from 'lucide-react';
import {NOTIFY_KINDS,kindsFor,type NotifyKind} from '../lib/notify-kinds';

const ago=(iso:string)=>{const m=Math.round((Date.now()-Date.parse(iso))/60000);return m<1?'방금':m<60?`${m}분 전`:m<1440?`${Math.round(m/60)}시간 전`:`${Math.round(m/1440)}일 전`};
const DEMO=(role:'owner'|'staff')=>({items:(role==='owner'?[
 {id:'d1',kind:'noshow',title:'정가상님 출근 기록이 없어요',body:'11:00 출근 예정이었어요. 12분째 기록이 없어요.',created_at:new Date(Date.now()-12*60000).toISOString(),read_at:null},
 {id:'d2',kind:'leave',title:'휴가 신청이 왔어요',body:'박샘플 · 연차 1일',created_at:new Date(Date.now()-3*3600000).toISOString(),read_at:null},
 {id:'d3',kind:'clockout',title:'김예시님 퇴근 기록이 없어요',body:'15:00 퇴근 예정이었는데 아직 근무 중으로 남아 있어요.',created_at:new Date(Date.now()-26*3600000).toISOString(),read_at:new Date().toISOString()},
]:[
 {id:'s1',kind:'before',title:'1시간 뒤 근무가 있어요',body:'09:00–15:00 근무예요. 매장 QR을 찍고 출근해 주세요.',created_at:new Date(Date.now()-40*60000).toISOString(),read_at:null},
 {id:'s2',kind:'schedule',title:'근무표가 바뀌었어요',body:'10/9 09:00–15:00 → 10/10 09:00–15:00',created_at:new Date(Date.now()-5*3600000).toISOString(),read_at:null},
]),prefs:{} as Record<string,boolean>});

export function NotifyBell({role,demo}:{role:'owner'|'staff',demo?:boolean}){
 const [data,setData]=useState<any>(null),[open,setOpen]=useState(false),[tab,setTab]=useState<'list'|'prefs'>('list'),box=useRef<HTMLDivElement>(null);
 const load=async()=>{if(demo){setData((d:any)=>d||DEMO(role));return}try{const r=await fetch('/api/notifications');if(r.ok)setData(await r.json())}catch{}};
 const post=async(b:any)=>{if(demo){setData((d:any)=>{const n={...d};if(b.action==='readAll')n.items=d.items.map((x:any)=>({...x,read_at:x.read_at||new Date().toISOString()}));if(b.action==='read')n.items=d.items.map((x:any)=>x.id===b.id?{...x,read_at:new Date().toISOString()}:x);if(b.action==='prefs')n.prefs=b.prefs;n.unread=n.items.filter((x:any)=>!x.read_at).length;return n});return}
  try{const r=await fetch('/api/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});if(r.ok)setData(await r.json())}catch{}};
 useEffect(()=>{load();if(demo)return;const t=setInterval(load,60000);return ()=>clearInterval(t)},[]);
 useEffect(()=>{if(!open)return;const f=(e:MouseEvent)=>{if(box.current&&!box.current.contains(e.target as Node))setOpen(false)};const k=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};addEventListener('mousedown',f);addEventListener('keydown',k);return ()=>{removeEventListener('mousedown',f);removeEventListener('keydown',k)}},[open]);
 const items=data?.items||[],unread=items.filter((x:any)=>!x.read_at).length,prefs=data?.prefs||{};
 return <div className="nb" ref={box}>
  <button type="button" className="nb-btn" aria-label={`알림 ${unread?unread+'개 안 읽음':'모아보기'}`} aria-expanded={open} onClick={()=>{setOpen(!open);setTab('list')}}><Bell size={20}/>{unread>0&&<b className="nb-count" aria-hidden="true">{unread>99?'99+':unread}</b>}</button>
  {open&&<div className="nb-panel" role="dialog" aria-label="알림">
   <div className="nb-head"><div className="nb-tabs" role="tablist"><button role="tab" aria-selected={tab==='list'} onClick={()=>setTab('list')}>알림</button><button role="tab" aria-selected={tab==='prefs'} onClick={()=>setTab('prefs')}>받을 알림</button></div>{tab==='list'&&unread>0&&<button type="button" className="nb-link" onClick={()=>post({action:'readAll'})}>모두 읽음</button>}</div>
   {tab==='list'?<ul className="nb-list">{items.map((x:any)=><li key={x.id} className={x.read_at?'':'unread'}><button type="button" onClick={()=>{if(!x.read_at)post({action:'read',id:x.id})}}><span className="nb-kind">{NOTIFY_KINDS[x.kind as NotifyKind]?.label||'알림'} · {ago(x.created_at)}</span><b>{x.title}</b><span>{x.body}</span>{!x.read_at&&<i className="sr-only">안 읽음</i>}</button></li>)}{!items.length&&<li className="nb-empty">아직 받은 알림이 없어요.</li>}</ul>
   :<div className="nb-prefs"><p>끈 알림은 휴대폰으로도, 여기에도 오지 않아요.</p>{kindsFor(role).map(k=><label key={k} className="nb-pref"><span><b>{NOTIFY_KINDS[k].label}</b><small>{NOTIFY_KINDS[k].desc}</small></span><input type="checkbox" role="switch" checked={prefs[k]!==false} onChange={e=>post({action:'prefs',prefs:{...prefs,[k]:e.target.checked}})}/></label>)}{demo&&<p className="footnote">체험 화면에서는 저장하지 않아요.</p>}</div>}
  </div>}
 </div>;
}
