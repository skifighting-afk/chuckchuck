'use client';
// 지시서 5주차 041: 직원 서류 보관함 화면(사장님: 직원별, 직원: 내 것)
import {useEffect,useState} from 'react';
import {shrinkImage} from './manual';
const when=(v:string)=>new Date(v).toLocaleDateString('ko-KR');
export function StaffDocs({employeeId,demo=false}:{employeeId?:string,demo?:boolean}){
 const [docs,setDocs]=useState<any[]|null>(demo?[]:null),[kinds,setKinds]=useState<string[]>(['보건증','통장 사본','자격증','친권자 동의서','교육 수료증','기타']),[kind,setKind]=useState('보건증'),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[view,setView]=useState('');
 const load=async()=>{if(demo)return;try{const r=await fetch('/api/staff-docs'+(employeeId?'?employee='+encodeURIComponent(employeeId):''));const d:any=await r.json();if(!r.ok)throw Error(d.error);setDocs(d.docs);setKinds(d.kinds)}catch(e){setErr((e as Error).message||'서류를 불러오지 못했어요.')}};
 useEffect(()=>{load()},[employeeId]);
 const post=async(b:any)=>{const r=await fetch('/api/staff-docs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const d:any=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'처리하지 못했어요.');return d};
 const up=async(f?:File|null)=>{if(!f)return;setBusy(true);setErr('');try{const img=await shrinkImage(f);if(demo){setDocs(x=>[{id:'demo-'+Date.now(),kind,created_at:new Date().toISOString(),url:'data:'+img.mime+';base64,'+img.body},...(x||[])]);return}await post({action:'upload',employeeId,kind,...img});await load()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}};
 return <section className="staff-docs" aria-label="서류 보관함">
  <p className="footnote">보건증·통장 사본처럼 일하는 데 필요한 서류 사진을 모아 둬요. 신분증·주민등록등본처럼 주민번호가 보이는 서류는 올리지 마세요.</p>
  <div className="t-inline sd-up"><label>종류 <select value={kind} onChange={e=>setKind(e.target.value)}>{kinds.map(k=><option key={k}>{k}</option>)}</select></label><label className="sd-file"><input type="file" accept="image/jpeg,image/png" capture="environment" disabled={busy} onChange={e=>{up(e.target.files?.[0]);e.target.value=''}}/>{busy?'올리는 중…':'사진 찍기·올리기'}</label></div>
  {err&&<p className="saas-error" role="alert">{err}</p>}
  {docs===null?<p>불러오는 중…</p>:docs.length?<ul className="sd-list">{docs.map(d=><li key={d.id}><button type="button" className="secondary" onClick={()=>setView(view===d.id?'':d.id)} aria-expanded={view===d.id}>{d.kind} · {when(d.created_at)}</button>{!demo&&<button type="button" className="link-btn" onClick={async()=>{if(!confirm('이 서류 사진을 지울까요?'))return;try{await post({action:'delete',id:d.id});await load()}catch(e){setErr((e as Error).message)}}}>지우기</button>}{view===d.id&&<img src={d.url||'/api/staff-docs?id='+encodeURIComponent(d.id)} alt={d.kind+' 사진'}/>}</li>)}</ul>:<p>아직 올린 서류가 없어요.</p>}
  {demo&&<p className="footnote">체험 화면에서는 저장되지 않아요.</p>}
 </section>;
}
