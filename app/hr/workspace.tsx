import {useMemo,useState} from 'react';
import {Users,ArrowLeft,ShieldCheck} from 'lucide-react';
import {createHrClient} from './client';
import {useHrData,useHrAction,Field,Empty} from './components';
import {HR_SCOPES,HR_LABELS,type HrScope,type HrClient,type HrContextView,type HrGrant} from '../../lib/hr/types';
export function HrWorkspace({demo=false}:{demo?:boolean}){
 const client=useMemo(()=>createHrClient(),[]),[branch,setBranch]=useState(new URLSearchParams(location.search).get('branch')||'');
 const {data:ctx,error,loading,reload}=useHrData<HrContextView>(client,'/api/hr/context'+(branch?'?branch='+encodeURIComponent(branch):''));
 return <main className="hr-workspace"><header className="hr-header"><a className="hr-back" href="/app"><ArrowLeft size={18}/>내 매장으로</a><div><h1><Users aria-hidden="true"/>사람·교육</h1><p>채용부터 함께 잘 일하는 과정까지.</p></div>{ctx&&<Field label="현재 매장"><select value={ctx.branchId} onChange={e=>setBranch(e.target.value)}>{ctx.branches.map(b=><option value={b.id} key={b.id}>{b.name}</option>)}</select></Field>}</header>
 {error?<div role="alert" className="hr-empty">{error}<button onClick={reload}>다시 연결</button></div>:!ctx?<p role="status">매장과 담당 권한을 확인하고 있어요.</p>:<><div className="hr-context"><b>{ctx.storeName} / {ctx.branches.find(b=>b.id===ctx.branchId)?.name}</b><span>{ctx.access==='owner'?'사장님·공동관리자':ctx.access==='manager'?'매니저':'직원'} 화면</span></div><section className="hr-panel"><h2>내 담당 범위</h2><p>현재 매장에서 맡은 일을 확인해요.</p><div className="hr-scope-list">{ctx.scopes.length?ctx.scopes.map(s=><span className="hr-tag" key={s}>{HR_LABELS[s]}</span>):<p>위임받은 관리 업무가 없어요. 직원 본인 기능은 각 메뉴에서 확인해요.</p>}</div></section>{ctx.access==='owner'&&<GrantsPanel key={ctx.branchId} client={client} ctx={ctx} onSaved={reload}/>}</>}
 </main>;
}
function GrantsPanel({client,ctx,onSaved}:{client:HrClient;ctx:HrContextView;onSaved:()=>Promise<void>}){
 const {data,loading,error,reload}=useHrData<{grants:HrGrant[]}>(client,'/api/hr/grants?branch='+encodeURIComponent(ctx.branchId));
 const [employeeId,setEmployee]=useState(''),[scope,setScope]=useState<HrScope>('training'),[until,setUntil]=useState('');
 const action=useHrAction(client,ctx.branchId,async()=>{await reload();await onSaved()});
 return <section className="hr-panel"><h2><ShieldCheck size={21}/>담당자 권한 설정</h2><p>근태·급여 권한과 별도로 지정해요. 선택한 매장 안에서만 적용되며 언제든 회수할 수 있어요.</p>
 <form className="hr-form hr-form-inline" onSubmit={e=>{e.preventDefault();void action.run('/api/hr/grants',{action:'grant',employeeId,scope,validUntil:until?new Date(until+'T23:59:59+09:00').toISOString():null})}}>
 <Field label="담당 직원"><select required value={employeeId} onChange={e=>setEmployee(e.target.value)}><option value="">직원을 선택해 주세요</option>{ctx.employees.map(e=><option key={e.id} value={e.id}>{e.name} · {e.role}</option>)}</select></Field><Field label="맡길 업무"><select value={scope} onChange={e=>setScope(e.target.value as HrScope)}>{HR_SCOPES.map(s=><option value={s} key={s}>{HR_LABELS[s]}</option>)}</select></Field><Field label="권한 만료일" hint="비워 두면 회수할 때까지 유지해요."><input type="date" value={until} onChange={e=>setUntil(e.target.value)}/></Field><button className="hr-primary" disabled={action.busy}>담당자로 지정</button>
 </form>{action.feedback}{error&&<p role="alert">{error}</p>}{loading&&!data?<p role="status">권한 목록을 불러오는 중이에요.</p>:!data?.grants.length?<Empty>아직 지정된 담당자가 없어요. 위에서 직원과 업무를 골라 주세요.</Empty>:<ul className="hr-records">{data.grants.map(g=><li key={g.id}><div><strong>{ctx.employees.find(e=>e.id===g.employeeId)?.name||'이전 소속 직원'}</strong><p>{HR_LABELS[g.scope]}</p><small>{g.revokedAt?'회수됨':g.validUntil?`만료 ${new Date(g.validUntil).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}`:'회수 전까지 유지'}</small></div>{!g.revokedAt&&<button disabled={action.busy} onClick={()=>void action.run('/api/hr/grants',{action:'revoke',id:g.id,version:g.version})}>권한 회수</button>}</li>)}</ul>}</section>;
}
