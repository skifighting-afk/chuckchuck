'use client';
// 홈 맨 위 '승인함': 직원이 가입 링크로 합류를 신청하면 여기 바로 뜨고, 사장님은 그 자리에서 수락·반려한다.
// 자세한 설정(가입 링크·근로조건)은 /staff-requests 화면 그대로.
import {useEffect,useState} from 'react';
import {ratesFor} from '../lib/pay-rules';

export function JoinInbox({onChanged}:{onChanged:()=>void}){
 const [data,setData]=useState<any>(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[done,setDone]=useState(''),[pay,setPay]=useState<Record<string,{payType:string,wage:string}>>({});
 const load=async()=>{try{const r=await fetch('/api/staff-join');const d:any=await r.json();if(r.ok&&d.owner)setData(d)}catch{}};
 useEffect(()=>{load();const t=setInterval(load,60000);return()=>clearInterval(t)},[]);
 const requests:any[]=data?.requests||[];
 if(!requests.length&&!done)return null;
 const min=ratesFor(new Date().getFullYear()).minimumWage;
 const review=async(a:any,approve:boolean)=>{
  const existing=data.employees.find((e:any)=>e.branchId===a.branchId&&e.email.toLowerCase()===a.email&&!data.linkedIds.includes(e.id));
  const p=pay[a.id]||{payType:'시급',wage:''};
  if(approve&&!a.contractText&&!existing&&!(Number(p.wage)>0)){setError(`${a.name}님의 임금을 먼저 입력해 주세요.`);return}
  if(!approve&&!window.confirm(`${a.name}님의 합류 신청을 반려할까요?`))return;
  setBusy(a.id);setError('');
  try{const r=await fetch('/api/staff-join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'review',id:a.id,approve,version:data.version,employeeId:existing?.id,...(approve&&!a.contractText&&!existing?{payType:p.payType,wage:Number(p.wage)}:{})})});const d:any=await r.json();if(!r.ok)throw Error(d.error);setDone(approve?`${a.name}님을 직원으로 연결했어요.`:`${a.name}님의 신청을 반려했어요.`);await load();if(approve)onChanged()}
  catch(e){setError(e instanceof Error?e.message:'다시 시도해 주세요.')}finally{setBusy('')}
 };
 return <section className="join-inbox" aria-labelledby="join-inbox-title">
  <div className="join-inbox-head"><h2 id="join-inbox-title">승인함 <b>{requests.length}</b></h2><a href="/staff-requests">가입 링크·조건 관리</a></div>
  {done&&<p className="saas-success" role="status">{done}</p>}{error&&<p className="saas-error" role="alert">{error}</p>}
  {requests.map(a=>{const existing=data.employees.find((e:any)=>e.branchId===a.branchId&&e.email.toLowerCase()===a.email&&!data.linkedIds.includes(e.id)),p=pay[a.id]||{payType:'시급',wage:''},needPay=!a.contractText&&!existing,low=p.payType==='시급'&&Number(p.wage)>0&&Number(p.wage)<min;
   return <article key={a.id} className="join-card">
    <div className="join-who"><b>{a.name}</b><span>{data.branches.find((b:any)=>b.id===a.branchId)?.name} · {a.phone||a.email}</span>{a.profile?.joined&&<span>첫 근무일 {a.profile.joined}</span>}{a.emailVerified===false&&<small>이메일 확인 전이에요. 실제 직원인지 확인하고 수락해 주세요.</small>}{existing&&<small>이미 입력해 둔 {existing.name}님 정보와 연결돼요.</small>}{a.contractText&&<small>직원이 근로조건을 확인하고 신청했어요.</small>}</div>
    {needPay&&<div className="join-pay-inline"><label>임금 기준<select value={p.payType} onChange={e=>setPay({...pay,[a.id]:{...p,payType:e.target.value}})}><option>시급</option><option>월급</option><option>일급</option></select></label><label>임금(원)<input type="number" inputMode="numeric" min={1} value={p.wage} placeholder={p.payType==='시급'?String(min):''} onChange={e=>setPay({...pay,[a.id]:{...p,wage:e.target.value}})}/></label>{low&&<small role="alert">최저시급 {min.toLocaleString('ko-KR')}원보다 낮아요.</small>}</div>}
    <div className="join-actions"><button type="button" className="saas-primary" disabled={!!busy} onClick={()=>review(a,true)}>{busy===a.id?'처리 중…':'수락'}</button><button type="button" className="saas-secondary" disabled={!!busy} onClick={()=>review(a,false)}>반려</button></div>
   </article>})}
 </section>;
}
