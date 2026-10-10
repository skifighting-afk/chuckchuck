import {useRef,useState,useEffect,type ReactNode} from 'react';
import type {HrClient,HrMeta} from '../../lib/hr/types';
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){return <label className="hr-field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>}
export function Empty({children}:{children:ReactNode}){return <div className="hr-empty">{children}</div>}
type Refresh=()=>void|boolean|Promise<void|boolean>;
export function useHrAction(client:HrClient,branchId:string,onSaved?:Refresh){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),pending=useRef<{key:string;id:string}|null>(null),locked=useRef(false),restoreFocus=useRef<{el:HTMLElement;container:Element|null}|null>(null);
 useEffect(()=>{if(!busy&&restoreFocus.current){const {el,container}=restoreFocus.current;restoreFocus.current=null;if(document.activeElement===document.body){if(el.isConnected)el.focus();else if(container?.isConnected)Array.from(container.querySelectorAll<HTMLElement>('textarea:not([disabled]),input:not([disabled]),button:not([disabled])')).find(n=>n.getClientRects().length)?.focus()}}},[busy]);
 const begin=()=>{if(locked.current)return false;locked.current=true;restoreFocus.current=document.activeElement instanceof HTMLElement?{el:document.activeElement,container:document.activeElement.closest('article,section')}:null;setBusy(true);setNotice('');return true};
 const refresh=async()=>{try{return await onSaved?.()!==false}catch{return false}};
 const run=async<T,>(path:string,body:object):Promise<T|undefined>=>{
  if(!begin())return;setError('');const key=JSON.stringify({path,branchId,...body});if(pending.current?.key!==key)pending.current={key,id:crypto.randomUUID()};
  try{const result=await client.post<T>(path,{...body,branchId,requestId:pending.current!.id});pending.current=null;if(await refresh())setNotice('저장했어요.');else setError('저장은 완료했지만 최신 내용을 불러오지 못했어요. 입력을 유지하고 다시 연결해 주세요.');return result}catch(e){setError(e instanceof Error?e.message:'연결 상태를 확인하고 다시 시도해 주세요.')}finally{locked.current=false;setBusy(false)}
 };
 const recover=async()=>{if(!begin())return;try{if(await refresh()){setError('');setNotice('최신 기록을 불러왔어요. 입력을 확인한 뒤 다시 저장해 주세요.')}else setError('최신 기록을 불러오지 못했어요. 입력은 유지했어요. 연결 상태를 확인하고 다시 시도해 주세요.')}finally{locked.current=false;setBusy(false)}};
 return{run,busy,error,notice,feedback:<><div role="alert" className="hr-error">{error}{error&&onSaved&&<button type="button" disabled={busy} onClick={recover}>입력 유지하고 최신 기록 확인</button>}</div><div role="status" aria-busy={busy} className="hr-notice">{notice}</div></>};
}
export function useHrData<T>(client:HrClient,path:string){
 const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[errorStatus,setErrorStatus]=useState(0),[loading,setLoading]=useState(true),generation=useRef(0);
 const reload=async()=>{const key=++generation.current;setLoading(true);try{const d=await client.get<T>(path);if(key===generation.current){setData(d);setError('');setErrorStatus(0);return true}return false}catch(e){if(key===generation.current){setError(e instanceof Error?e.message:'다시 연결해 주세요.');setErrorStatus(typeof e==='object'&&e!==null&&'status' in e?Number(e.status)||0:0)}return false}finally{if(key===generation.current)setLoading(false)}};
 useEffect(()=>{setData(null);void reload();return()=>{generation.current++}},[client,path]);return{data,error,errorStatus,loading,reload};
}
const labels:Record<string,string>={buddyId:'교육 담당자',assigneeId:'담당자',level:'숙련도',note:'확인 메모',checkedBy:'확인 담당',checkedAt:'확인 시각',from:'교육 시작',until:'교육 종료',unit:'희망 기준',min:'최소 희망량',max:'최대 희망량',reviewNote:'검토 메모',reviewedBy:'검토 담당',reviewedAt:'검토 시각'};
export function ChangeHistory({record,people=[]}:{record:HrMeta;people?:{id:string;name:string}[]}){
 const text=(key:string,value:string|number|null)=>{if(value===null||value==='')return '미지정';if(['buddyId','assigneeId'].includes(key))return value==='owner'?'사장님·공동관리자':people.find(p=>p.id===value)?.name||'이전 담당자';if(['checkedBy','reviewedBy'].includes(key))return '담당자 확인';if(key==='unit')return value==='hours'?'시간':'일';if(['checkedAt','reviewedAt'].includes(key))return new Date(String(value)).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});return String(value)};
 if(!record.changes?.length)return null;return <details className="hr-change-history"><summary>변경 기록 {record.changes.length}건</summary><ol>{record.changes.map((h,i)=><li key={i}><small>{new Date(h.at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · {h.byEmployeeId?people.find(p=>p.id===h.byEmployeeId)?.name||'이전 담당자':'사장님·공동관리자'}</small>{Object.keys(h.after).map(k=><p key={k}><strong>{labels[k]||k}</strong> {text(k,h.before[k])} → {text(k,h.after[k])}</p>)}</li>)}</ol></details>;
}
