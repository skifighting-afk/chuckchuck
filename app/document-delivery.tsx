import {useEffect,useState} from 'react';
import {renderPages,documentsPdf,saveBlob} from './doc-render';
export function DocumentStatus({activity}:{activity:any}){return <span>{activity?.viewed_at?'확인함':'확인 대기 중'} · {activity?.saved_at?'직원 저장 확인':activity?.download_requested_at?'다운로드 요청됨 · 저장 확인 대기':'다운로드 대기 중'}</span>}
async function post(body:any){const r=await fetch('/api/documents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d:any=await r.json();if(!r.ok)throw Error(d.error);return d;}
export function DocumentDownload({kind,id,onChange}:{kind:string,id:string,onChange?:()=>void}){
 const [doc,setDoc]=useState<any>(null),[error,setError]=useState(''),[pages,setPages]=useState<Blob[]>([]),[done,setDone]=useState<Set<number>>(new Set()),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;setDoc(null);setPages([]);setDone(new Set());setError('');fetch('/api/documents?kind='+kind+'&id='+encodeURIComponent(id)).then(async r=>{const d:any=await r.json();if(!r.ok)throw Error(d.error);if(active)setDoc(d)}).catch(e=>active&&setError(e.message));return()=>{active=false}},[id,kind]);
 async function prepare(){setBusy(true);setError('');try{setPages(await renderPages(title,doc.text,'문서 '+id))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const title=kind==='contract'?'근로계약서':'급여명세서';
 async function record(){if(doc.employee)try{const d=await post({kind,id,action:'download'});setDoc({...doc,activity:d.activity});onChange?.()}catch(e){setError('파일 저장 요청은 했지만 상태를 기록하지 못했어요. 다시 내려받아 주세요.')}}
 async function pdf(){setBusy(true);setError('');try{saveBlob(title+'-'+id+'.pdf',await documentsPdf([{title,text:doc.text,footer:'문서 '+id}],title));await record()}catch(e){setError((e as Error).message||'PDF를 만들지 못했어요. 이미지로 저장해 주세요.')}finally{setBusy(false)}}
 async function download(index:number){setError('');const url=URL.createObjectURL(pages[index]),a=document.createElement('a');a.href=url;a.download=(kind==='contract'?'근로계약서':'급여명세서')+'-'+id+'-'+(index+1)+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);const next=new Set(done).add(index);setDone(next);if(next.size===pages.length)await record()}
 async function saved(){setBusy(true);try{const d=await post({kind,id,action:'saved'});setDoc({...doc,activity:d.activity});onChange?.()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="contract-copy"><h3>문서 저장</h3>{error&&<p role="alert">{error}</p>}{doc&&<><p><DocumentStatus activity={doc.activity}/></p><p>본문과 서명 기록을 모두 포함해요. 여러 장이면 모든 장을 저장해 주세요.</p><div className="t-wrapactions"><button className="saas-primary" disabled={busy} onClick={pdf}>{busy?'만드는 중…':'PDF로 저장'}</button><button className="saas-secondary" disabled={busy} onClick={prepare}>{pages.length?'이미지 다시 준비':'이미지로 저장(장별)'}</button>{pages.map((_,i)=><button className="saas-primary" key={i} onClick={()=>download(i)}>이미지 {i+1}/{pages.length} 내려받기{done.has(i)?' ✓':''}</button>)}</div><small>다운로드 요청은 실제 저장 완료와 달라요. 휴대폰 파일 앱이나 다운로드 폴더에서 확인해 주세요.</small>{doc.employee&&doc.activity.download_requested_at&&!doc.activity.saved_at&&<button className="saas-primary" disabled={busy} onClick={saved}>파일을 확인했어요 · 저장 완료 알리기</button>}{doc.activity.saved_at&&<p>직원이 저장을 확인한 시각: {new Date(doc.activity.saved_at).toLocaleString('ko-KR')}</p>}</>}</section>
}
const STATE_LABEL:Record<string,string>={current:'최신 확정본',reopened:'다시 확인 중 · 사장님이 급여를 고치고 있어요',replaced:'지난 수정본 · 새 명세서를 확인해 주세요'};
export function PayslipDesk({month,branch,rows,locked}:{month:string,branch?:string,rows?:any[],locked?:boolean}){
 const [docs,setDocs]=useState<any[]>([]),[selected,setSelected]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState('');
 async function load(){try{const r=await fetch('/api/documents'),d:any=await r.json();if(!r.ok)throw Error(d.error);setDocs(d.documents)}catch(e){setError((e as Error).message)}}
 useEffect(()=>{setSelected(null);load()},[month,branch]);
 const runKey=month+':'+branch;
 const mine=docs.filter(d=>d.document.month===month&&(!branch||d.run_key===runKey));
 async function send(employeeId:string){setBusy(employeeId);setError('');try{await post({action:'send',runKey,employeeId});await load()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 async function sendAll(){for(const r of rows||[]){const sent=mine.some(d=>d.employee_id===r.employeeId&&d.state==='current');if(!sent)await send(r.employeeId)}}
 async function open(d:any){setError('');try{if(!rows)await post({action:'view',kind:'payslip',id:d.id});setSelected(d);await load()}catch(e){setError((e as Error).message)}}
 async function bundle(){setBusy('bundle');setError('');try{const list=mine.filter(d=>d.state==='current');const docs=[];for(const d of list){const r=await fetch('/api/documents?kind=payslip&id='+encodeURIComponent(d.id)),v:any=await r.json();if(!r.ok)throw Error(v.error);docs.push({title:'급여명세서',text:v.text,footer:'문서 '+d.id})}saveBlob(`급여명세서-합본-${month}.pdf`,await documentsPdf(docs,`급여명세서 합본 · ${month}`))}catch(e){setError((e as Error).message||'합본을 만들지 못했어요. 다시 시도해 주세요.')}finally{setBusy('')}}
 const latest=(employeeId:string)=>mine.filter(d=>d.employee_id===employeeId).sort((a,b)=>b.revision-a.revision)[0];
 return <section className="panel" style={{padding:24,marginTop:24}}><h2>{rows?'직원에게 명세서 보내기':'받은 급여명세서'}</h2><p>{rows?'직원 앱으로 보내요. 이메일이나 도메인은 필요 없어요.':'사장님이 보내신 확정본을 확인하고 이미지로 저장하세요.'}</p>{error&&<p role="alert">{error}</p>}
 {rows&&!locked&&<p>급여를 먼저 검토·확정해 주세요.</p>}
 {rows&&locked&&rows.length>1&&<div className="t-wrapactions"><button className="saas-secondary" disabled={!!busy} onClick={sendAll}>아직 안 보낸 직원에게 모두 보내기</button></div>}{rows&&mine.some(d=>d.state==='current')&&<div className="t-wrapactions"><button className="saas-secondary" disabled={!!busy} onClick={bundle}>{busy==='bundle'?'합본 만드는 중…':`보낸 명세서 합본 PDF (${mine.filter(d=>d.state==='current').length}명)`}</button></div>}
 {rows?.map(r=>{const d=latest(r.employeeId),sent=d&&d.state==='current';return <div className="t-wrapactions" key={r.employeeId}><b>{r.name}</b>{sent?<span>보냄 · 수정본 {d.revision} · <DocumentStatus activity={d.activity}/></span>:<button className="saas-primary" disabled={!!busy||!locked} onClick={()=>send(r.employeeId)}>{busy===r.employeeId?'보내는 중…':d?'새 수정본 보내기':'직원 앱으로 보내기'}</button>}</div>})}
 <button onClick={load}>상태 새로 확인</button>
 {mine.map(d=><div key={d.id} style={{padding:'16px 0',borderBottom:'1px solid #ddd'}}><button onClick={()=>open(d)}>{d.document.name} · {d.document.month} · 수정본 {d.revision} 열기</button><p><b>{STATE_LABEL[d.state]||''}</b></p><p><DocumentStatus activity={d.activity}/></p></div>)}
 {!mine.length&&<p>이번 달 보낸 명세서가 아직 없어요.</p>}
 {selected&&<>{selected.state!=='current'&&<p role="status"><b>{STATE_LABEL[selected.state]}</b></p>}<pre className="t-document">{selected.document.text}</pre><DocumentDownload key={selected.id} kind="payslip" id={selected.id} onChange={load}/></>}</section>
}
