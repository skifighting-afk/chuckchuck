import {useRef,useState,useEffect,type ReactNode} from 'react';
import type {HrClient} from '../../lib/hr/types';
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){return <label className="hr-field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>}
export function Empty({children}:{children:ReactNode}){return <div className="hr-empty">{children}</div>}
export function useHrAction(client:HrClient,branchId:string,onSaved?:()=>void|Promise<void>){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),pending=useRef<{key:string;id:string}|null>(null),locked=useRef(false);
 const run=async<T,>(path:string,body:object):Promise<T|undefined>=>{
  if(locked.current)return;locked.current=true;setBusy(true);setError('');setNotice('');
  const key=JSON.stringify({path,branchId,...body});if(pending.current?.key!==key)pending.current={key,id:crypto.randomUUID()};
  try{const result=await client.post<T>(path,{...body,branchId,requestId:pending.current!.id});pending.current=null;setNotice('저장했어요.');await onSaved?.();return result}catch(e){setError(e instanceof Error?e.message:'연결 상태를 확인하고 다시 시도해 주세요.')}finally{locked.current=false;setBusy(false)}
 };
 return{run,busy,error,notice,feedback:<><div role="alert" className="hr-error">{error}</div><div role="status" className="hr-notice">{notice}</div></>};
}
export function useHrData<T>(client:HrClient,path:string){
 const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),generation=useRef(0);
 const reload=async()=>{const key=++generation.current;setLoading(true);try{const d=await client.get<T>(path);if(key===generation.current){setData(d);setError('')}}catch(e){if(key===generation.current)setError(e instanceof Error?e.message:'다시 연결해 주세요.')}finally{if(key===generation.current)setLoading(false)}};
 useEffect(()=>{setData(null);void reload();return()=>{generation.current++}},[client,path]);
 return{data,error,loading,reload};
}
