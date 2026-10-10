import type {HrDatabase,HrContext,HrCommandMeta,HrMutationResult} from '../../lib/hr/types';
import {canWrite} from '../../lib/plans';
import {contextFromRow,HrError,deny,conflict} from './context';
export async function fingerprint(value:unknown):Promise<string>{
 const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(value)))))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
type MutationMeta<T>=HrCommandMeta&{operation:string;fingerprint:string;authorize:(ctx:HrContext)=>void;target:(record:T)=>string;replay:(tx:HrDatabase,ctx:HrContext,id:string)=>Promise<T>};
export async function withHrMutation<T>(db:HrDatabase,ctx:HrContext,meta:MutationMeta<T>,work:(tx:HrDatabase,fresh:HrContext)=>Promise<T>):Promise<HrMutationResult<T>>{
 return db.transaction(async tx=>{
  const row=await tx.prepare('SELECT owner,data,version FROM stores WHERE owner=? FOR UPDATE').bind(ctx.ownerId).first<any>();if(!row)deny();
  const fresh=await contextFromRow(tx,ctx.userId,row,ctx.branchId);meta.authorize(fresh);
  if(!canWrite(fresh.store._account))deny('지금은 조회만 가능해요. 사장님이 계정·요금제에서 이용 상태를 확인해 주세요.');
  const old=await tx.prepare('SELECT operation,fingerprint,target_id FROM hr_audit WHERE owner=? AND actor=? AND request_id=?').bind(ctx.ownerId,ctx.userId,meta.requestId).first<any>();
  if(old){if(old.operation!==meta.operation||old.fingerprint!==meta.fingerprint)conflict();return {record:await meta.replay(tx,fresh,old.target_id),replayed:true}}
  const record=await work(tx,fresh);
  await tx.prepare('INSERT INTO hr_audit(owner,id,branch_id,actor,request_id,operation,fingerprint,target_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(ctx.ownerId,crypto.randomUUID(),fresh.branchId,fresh.userId,meta.requestId,meta.operation,meta.fingerprint,meta.target(record),fresh.now).run();
  return {record,replayed:false};
 });
}
