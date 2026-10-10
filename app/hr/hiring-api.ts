import type {Candidate,HrContext,HrDatabase,HiringView} from '../../lib/hr/types';
import {canHr} from '../../lib/hr/access';
import {hiringSchema,candidatePurgeAt} from '../../lib/hr/hiring';
import {staffGone} from '../../lib/staff-access';
import {teamSchema,newMember} from '../../lib/team-model';
import {deny,HrError,notFound,conflict} from './context';
import {withHrMutation,fingerprint} from './mutation';
import {listRecords,getRecord,makeRecord,revise,putRecord,expectVersion} from './records';
const authorize=(ctx:HrContext)=>{if(!canHr(ctx,'hiring','manage'))deny()};
async function retention(db:HrDatabase,ctx:HrContext){const r=await db.prepare('SELECT candidate_retention_days FROM hr_settings WHERE owner=?').bind(ctx.ownerId).first<any>();return {id:'retention',candidateRetentionDays:r?.candidate_retention_days??null}}
export async function hiringRead(db:HrDatabase,ctx:HrContext):Promise<HiringView>{
 authorize(ctx);const candidates=await listRecords<Candidate>(db,ctx,'hr_candidates'),settings=await retention(db,ctx);
 return{candidates,storeVersion:ctx.storeVersion,owner:ctx.access==='owner',employees:ctx.access==='owner'?ctx.store.employees.filter(e=>e.branchId===ctx.branchId&&!e.anonymizedAt&&!staffGone(e)).map(e=>({id:e.id,name:e.name})):[],candidateRetentionDays:settings.candidateRetentionDays,deletionPreview:candidates.flatMap(c=>{const purgeAt=candidatePurgeAt(c,settings.candidateRetentionDays);return purgeAt?[{id:c.id,name:c.name,purgeAt}]:[]})};
}
export async function hiringWrite(db:HrDatabase,ctx:HrContext,input:unknown){
 const b=hiringSchema.parse(input);authorize(ctx);
 const auth=(c:HrContext)=>{authorize(c);if(['convert','retentionSettings'].includes(b.action)&&c.access!=='owner')deny()};auth(ctx);
 if(b.action==='retentionSettings')return withHrMutation<Awaited<ReturnType<typeof retention>>>(db,ctx,{...b,operation:'hiring:'+b.action,fingerprint:await fingerprint(b),authorize:auth,target:r=>r.id,replay:retention},async(tx,c)=>{await tx.prepare('INSERT INTO hr_settings(owner,candidate_retention_days,updated_at,updated_by) VALUES(?,?,?,?) ON CONFLICT(owner) DO UPDATE SET candidate_retention_days=EXCLUDED.candidate_retention_days,updated_at=EXCLUDED.updated_at,updated_by=EXCLUDED.updated_by').bind(c.ownerId,b.candidateRetentionDays,c.now,c.userId).run();return retention(tx,c)});
 return withHrMutation<Candidate>(db,ctx,{...b,operation:'hiring:'+b.action,fingerprint:await fingerprint(b),authorize:auth,target:r=>r.id,replay:(tx,c,id)=>getRecord<Candidate>(tx,c,'hr_candidates',id)},async(tx,c)=>{
  if(b.action==='save'){
   const fields={name:b.name,phone:b.phone,role:b.role,availability:b.availability,source:b.source,questions:b.questions};
   if(!b.id)return putRecord(tx,c,'hr_candidates',makeRecord(c,{...fields,stage:'지원 접수' as const,interviewAt:null,convertedEmployeeId:null,closedAt:null}));
   const old=await getRecord<Candidate>(tx,c,'hr_candidates',b.id);expectVersion(old,b.version);return putRecord(tx,c,'hr_candidates',revise(c,old,fields),old);
  }
  const old=await getRecord<Candidate>(tx,c,'hr_candidates',b.id);expectVersion(old,b.version);
  if(b.action==='archive')return putRecord(tx,c,'hr_candidates',revise(c,old,{stage:'종료',closedAt:old.closedAt||c.now}),old);
  if(b.action==='stage'){
   if(old.convertedEmployeeId&&b.stage!=='종료')throw new HrError(409,'이미 직원과 연결됐어요. 직원 관리에서 상태를 확인해 주세요.');
   if(b.stage==='면접 예정'&&!b.interviewAt)throw new HrError(400,'면접 날짜와 시간을 입력해 주세요.');
   return putRecord(tx,c,'hr_candidates',revise(c,old,{stage:b.stage,interviewAt:b.interviewAt,closedAt:['종료','지원 철회'].includes(b.stage)?old.closedAt||c.now:null}),old);
  }
  if(old.stage!=='채용 결정'||old.convertedEmployeeId)throw new HrError(409,'채용 결정과 기존 연결 상태를 확인해 주세요.');
  if(c.storeVersion!==b.storeVersion)conflict();
  let employeeId:string;
  if(b.mode==='link'){const e=c.store.employees.find(e=>e.id===b.employeeId&&e.branchId===c.branchId&&!e.anonymizedAt&&!staffGone(e));if(!e)notFound();employeeId=e.id}
  else{
   const e={...newMember(c.branchId),name:old.name,phone:old.phone,role:old.role,status:'입사 준비' as const,wage:0,autoPay:false},next={...c.store,employees:[...c.store.employees,e]};
   // Attendance lives in its own table; validate Team without copying it into stores.data.
   const checked=teamSchema.safeParse({...next,attendance:next.attendance||[]});if(!checked.success)throw new HrError(400,'직원 등록 조건을 확인해 주세요. 임금·계약은 입사 준비에서 입력해요.');
   const saved=await tx.prepare('UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify({...next,employees:checked.data.employees}),c.now,c.ownerId,c.storeVersion).run();if(!saved.meta.changes)conflict();employeeId=e.id;
  }
  return putRecord(tx,c,'hr_candidates',revise(c,old,{convertedEmployeeId:employeeId}),old);
 });
}
