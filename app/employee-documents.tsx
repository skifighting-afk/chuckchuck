import {useEffect,useState} from 'react';
import {documentOverview,filterDocumentOverview,type DocumentKind} from '../lib/document-overview';
import type {Member} from '../lib/team-model';

export function EmployeeDocuments({employees,month,branch,branchName,locked,demo,version,onMonth,onEdit,onContract,onPayroll}:{employees:Member[];month:string;branch:string;branchName:string;locked:boolean;demo:boolean;version:number;onMonth:(month:string)=>void;onEdit:(e:Member)=>void;onContract:(e:Member)=>void;onPayroll:()=>void}){
 const [contracts,setContracts]=useState<any[]|null>(null),[docs,setDocs]=useState<any[]|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[refresh,setRefresh]=useState(0),[query,setQuery]=useState(''),[filter,setFilter]=useState('전체');
 const runKey=month+':'+branch;
 const [kind,setKind]=useState<DocumentKind>('all'),[docState,setDocState]=useState('all');
 useEffect(()=>{setDocState('all')},[runKey]);
 useEffect(()=>{
  if(demo){setContracts([]);setDocs([]);setError('');return}
  let active=true;setContracts(null);setDocs(null);setError('');setLoading(true);
  const get=async(url:string,key:string)=>{const r=await fetch(url),d:any=await r.json();if(!r.ok||!Array.isArray(d[key]))throw Error(d.error||'서류 상태를 불러오지 못했어요.');return d[key]};
  Promise.allSettled([get('/api/contracts?summary=1','contracts'),get('/api/documents?summary=1&runKey='+encodeURIComponent(runKey),'documents')]).then(results=>{
   if(!active)return;const [c,d]=results;setContracts(c.status==='fulfilled'?c.value:null);setDocs(d.status==='fulfilled'?d.value:null);if(results.some(r=>r.status==='rejected'))setError('일부 서류 상태를 확인하지 못했어요. 다시 확인해 주세요.');setLoading(false);
  });return()=>{active=false};
 },[runKey,demo,refresh,version]);
 const rows=documentOverview(employees,contracts,docs,runKey,locked),pending=filterDocumentOverview(rows,{query:'',kind,state:'all',pending:true}).length;
 const statuses=[...new Set([...rows.flatMap(r=>kind==='all'?[r.contract.label,r.payslip.label]:[r[kind].label]),...(docState==='all'?[]:[docState])])];
 const visible=filterDocumentOverview(rows,{query,kind,state:docState,pending:filter!=='전체'});
 const resetFilters=()=>{setQuery('');setKind('all');setDocState('all');setFilter('전체')};
 return <section className="panel document-overview" aria-labelledby="document-overview-title" aria-busy={loading}>
  <div className="document-overview-head"><div><h2 id="document-overview-title">직원별 근로계약서·급여명세서</h2><p>{branchName} · {month} 급여명세서와 근로계약서</p></div><button type="button" className="secondary" disabled={loading} onClick={()=>setRefresh(n=>n+1)}>{loading?'확인 중…':'상태 새로 확인'}</button></div>
  {demo&&<p className="notice">예시 직원의 서면 계약 기록입니다. 전자서명·명세서 전달 상태는 실제 매장에서 확인할 수 있어요.</p>}
  {error&&<p role="alert">{error}</p>}
  <div className="document-overview-tools"><label>급여명세서 월<input type="month" value={month} onChange={e=>{if(e.target.value){onMonth(e.target.value);setDocState('all')}}}/></label><label>직원 찾기<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="직원 이름"/></label><label>찾을 문서<select value={kind} onChange={e=>{setKind(e.target.value as DocumentKind);setDocState('all')}}><option value="all">근로계약서·급여명세서</option><option value="contract">근로계약서</option><option value="payslip">급여명세서</option></select></label><label>문서 상태<select value={docState} onChange={e=>setDocState(e.target.value)}><option value="all">모든 상태</option>{statuses.map(s=><option key={s} value={s}>{s}</option>)}</select></label><div className="staff-filter" role="group" aria-label="서류 상태 필터">{['전체','처리할 서류'].map(f=><button type="button" key={f} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f} {f==='전체'?rows.length:pending}</button>)}</div><button type="button" className="secondary" onClick={resetFilters}>검색 조건 초기화</button></div>
  <p className="document-filter-result" role="status" aria-live="polite">{loading?'문서 상태 확인 중…':`${rows.length}명 중 ${visible.length}명 표시`}</p>
  <div className="document-overview-rows">{visible.map(r=>{const e=employees.find(e=>e.id===r.employee.id)!;return <article className="document-overview-row" key={e.id} aria-label={e.name+' 서류'}><div className="document-employee"><h3>{e.name}</h3><span>{e.employment}</span></div><div className="document-state"><span>근로계약서</span><b className={'document-status '+r.contract.tone}>{r.contract.label}</b>{r.contractId?<a href="/contracts">근로계약서 목록</a>:<button type="button" className="link-btn" onClick={()=>onContract(e)}>근로조건 사본 보기</button>}</div><div className="document-state"><span>{month} 급여명세서</span><b className={'document-status '+r.payslip.tone}>{r.payslip.label}</b><button type="button" className="link-btn" onClick={onPayroll}>급여·급여명세서로 이동</button></div><button type="button" className="secondary" onClick={()=>onEdit(e)}>근로조건 수정</button></article>})}</div>
  {!visible.length&&<p className="document-empty">{rows.length?'선택한 조건에 해당하는 직원이 없어요. 검색 조건을 초기화해 다시 찾아보세요.':'직원을 등록하면 근로계약서와 급여명세서를 함께 확인할 수 있어요.'}</p>}
  <p className="footnote">서면 체결 기록과 양측 전자서명은 구분해 표시해요. 명세서 전달 완료와 직원 확인 여부도 각각 남습니다.</p>
 </section>;
}
