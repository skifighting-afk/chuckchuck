import {useEffect,useState} from 'react';
import {documentOverview} from '../lib/document-overview';
import type {Member} from '../lib/team-model';

export function EmployeeDocuments({employees,month,branch,branchName,locked,demo,version,onMonth,onEdit,onContract,onPayroll}:{employees:Member[];month:string;branch:string;branchName:string;locked:boolean;demo:boolean;version:number;onMonth:(month:string)=>void;onEdit:(e:Member)=>void;onContract:(e:Member)=>void;onPayroll:()=>void}){
 const [contracts,setContracts]=useState<any[]|null>(null),[docs,setDocs]=useState<any[]|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[refresh,setRefresh]=useState(0),[query,setQuery]=useState(''),[filter,setFilter]=useState('전체');
 const runKey=month+':'+branch;
 useEffect(()=>{
  if(demo){setContracts([]);setDocs([]);setError('');return}
  let active=true;setContracts(null);setDocs(null);setError('');setLoading(true);
  const get=async(url:string,key:string)=>{const r=await fetch(url),d:any=await r.json();if(!r.ok||!Array.isArray(d[key]))throw Error(d.error||'서류 상태를 불러오지 못했어요.');return d[key]};
  Promise.allSettled([get('/api/contracts?summary=1','contracts'),get('/api/documents?summary=1&runKey='+encodeURIComponent(runKey),'documents')]).then(results=>{
   if(!active)return;const [c,d]=results;setContracts(c.status==='fulfilled'?c.value:null);setDocs(d.status==='fulfilled'?d.value:null);if(results.some(r=>r.status==='rejected'))setError('일부 서류 상태를 확인하지 못했어요. 다시 확인해 주세요.');setLoading(false);
  });return()=>{active=false};
 },[runKey,demo,refresh,version]);
 const rows=documentOverview(employees,contracts,docs,runKey,locked),pending=rows.filter(r=>r.needsAction).length;
 const visible=rows.filter(r=>(!query||r.employee.name.includes(query.trim()))&&(filter==='전체'||r.needsAction));
 return <section className="panel document-overview" aria-labelledby="document-overview-title" aria-busy={loading}>
  <div className="document-overview-head"><div><h2 id="document-overview-title">직원별 서류 현황</h2><p>{branchName} · {month} 명세서와 근로계약서</p></div><button type="button" className="secondary" disabled={loading} onClick={()=>setRefresh(n=>n+1)}>{loading?'확인 중…':'상태 새로 확인'}</button></div>
  {demo&&<p className="notice">예시 직원의 서면 계약 기록입니다. 전자서명·명세서 전달 상태는 실제 매장에서 확인할 수 있어요.</p>}
  {error&&<p role="alert">{error}</p>}
  <div className="document-overview-tools"><label>명세서 월<input type="month" value={month} onChange={e=>{if(e.target.value)onMonth(e.target.value)}}/></label><label>직원 찾기<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="직원 이름"/></label><div className="staff-filter" role="group" aria-label="서류 상태 필터">{['전체','처리할 서류'].map(f=><button type="button" key={f} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f} {f==='전체'?rows.length:pending}</button>)}</div></div>
  <div className="document-overview-rows">{visible.map(r=>{const e=employees.find(e=>e.id===r.employee.id)!;return <article className="document-overview-row" key={e.id} aria-label={e.name+' 서류'}><div className="document-employee"><h3>{e.name}</h3><span>{e.employment}</span></div><div className="document-state"><span>근로계약서</span><b className={'document-status '+r.contract.tone}>{r.contract.label}</b>{r.contractId?<a href="/contracts">전자계약서 목록</a>:<button type="button" className="link-btn" onClick={()=>onContract(e)}>근로조건 사본 보기</button>}</div><div className="document-state"><span>{month} 명세서</span><b className={'document-status '+r.payslip.tone}>{r.payslip.label}</b><button type="button" className="link-btn" onClick={onPayroll}>급여·명세서로 이동</button></div><button type="button" className="secondary" onClick={()=>onEdit(e)}>근로조건 수정</button></article>})}</div>
  {!visible.length&&<p className="document-empty">{rows.length?'선택한 조건에 해당하는 직원이 없어요.':'직원을 등록하면 계약서와 명세서를 함께 확인할 수 있어요.'}</p>}
  <p className="footnote">서면 체결 기록과 양측 전자서명은 구분해 표시해요. 명세서 전달 완료와 직원 확인 여부도 각각 남습니다.</p>
 </section>;
}
