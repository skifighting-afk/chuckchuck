import type {HrContext,HrDatabase,HrMeta,BuddyAssignment,SkillDefinition,SkillRecord,TrainingView} from '../../lib/hr/types';
import {trainingSchema} from '../../lib/hr/training';
import {manualVisibleTo} from '../../lib/manual-view';
import {deny,notFound,HrError,contextView} from './context';
import {activePeople,person,isManager,hrToday,readableManual} from './people';
import {withHrMutation,fingerprint} from './mutation';
import {listRecords,getRecord,makeRecord,revise,putRecord,expectVersion,type HrTable} from './records';
function buddyActive(c:HrContext,a:BuddyAssignment){return activePeople(c).some(e=>e.id===a.buddyId)&&hrToday(c)>=a.from&&hrToday(c)<=a.until}
function buddyVisible(c:HrContext,a:BuddyAssignment){return c.access==='owner'||a.employeeId===c.selfId||(a.buddyId===c.selfId&&buddyActive(c,a))}
async function projectedBuddy(db:HrDatabase,c:HrContext,id:string){const a=await getRecord<BuddyAssignment>(db,c,'hr_buddy_assignments',id);if(!buddyVisible(c,a))deny();return {...a,steps:a.steps.map(s=>{const m=c.store._manuals?.find(m=>m.id===s.manualId);return {...s,manualId:m&&(c.access==='owner'||manualVisibleTo(m,person(c,c.selfId!)))?s.manualId:null}})}}
export async function trainingRead(db:HrDatabase,c:HrContext):Promise<TrainingView>{
 const manage=isManager(c,'training'),all=await listRecords<BuddyAssignment>(db,c,'hr_buddy_assignments'),buddies=[];
 for(const a of all.filter(a=>buddyVisible(c,a)))buddies.push({...await projectedBuddy(db,c,a.id),handover:!activePeople(c).some(e=>e.id===a.buddyId)});
 const skills=(await listRecords<SkillDefinition>(db,c,'hr_skill_definitions')).map(s=>{const m=c.store._manuals?.find(m=>m.id===s.manualId);return {...s,manualId:m&&(c.access==='owner'||manualVisibleTo(m,person(c,c.selfId!)))?s.manualId:null}});
 const records=(await listRecords<SkillRecord>(db,c,'hr_skill_records')).filter(r=>manage||r.employeeId===c.selfId);
 const related=new Set(buddies.flatMap(a=>[a.employeeId,a.buddyId]));
 return{context:contextView(c),manage,buddies,skills,records,manuals:(c.store._manuals||[]).filter(m=>(m.branchId==='all'||m.branchId===c.branchId)&&(c.access==='owner'||manualVisibleTo(m,person(c,c.selfId!)))).map(m=>({id:m.id,title:m.title})),people:activePeople(c).filter(e=>manage||e.id===c.selfId||related.has(e.id)).map(e=>({id:e.id,name:e.name})),legacySkills:activePeople(c).filter(e=>manage||e.id===c.selfId).map(e=>({employeeId:e.id,tags:e.extra?.skills||[]}))};
}
export async function trainingWrite(db:HrDatabase,ctx:HrContext,input:unknown){
 const b=trainingSchema.parse(input),managerActions=['assignBuddy','reassignBuddy','saveSkill','setLevel'];
 const auth=(c:HrContext)=>{if(managerActions.includes(b.action)&&!isManager(c,'training'))deny()};auth(ctx);
 const table:HrTable=['saveSkill'].includes(b.action)?'hr_skill_definitions':['setLevel','requestReview'].includes(b.action)?'hr_skill_records':'hr_buddy_assignments';
 const read=async(tx:HrDatabase,c:HrContext,id:string):Promise<HrMeta>=>{if(table==='hr_buddy_assignments')return projectedBuddy(tx,c,id);const r=await getRecord<any>(tx,c,table,id);if(table==='hr_skill_records'&&!isManager(c,'training')&&r.employeeId!==c.selfId)deny();return r};
 return withHrMutation<HrMeta>(db,ctx,{...b,operation:'training:'+b.action,fingerprint:await fingerprint(b),authorize:auth,target:r=>r.id,replay:read},async(tx,c)=>{
  if(b.action==='assignBuddy'){
   if(c.access!=='owner'&&b.buddyId!==c.selfId)deny('담당자는 본인에게 배정할 교육만 만들 수 있어요.');
   person(c,b.employeeId);person(c,b.buddyId);if(b.employeeId===b.buddyId||b.until<b.from)throw new HrError(400,'교육 기간과 서로 다른 담당자를 확인해 주세요.');for(const s of b.steps)readableManual(c,s.manualId,[b.employeeId,b.buddyId]);
   return putRecord(tx,c,table,makeRecord(c,{employeeId:b.employeeId,buddyId:b.buddyId,from:b.from,until:b.until,steps:b.steps.map(s=>({...s,id:crypto.randomUUID(),progress:'todo' as const,note:'',staffAckAt:null}))}));
  }
  if(b.action==='saveSkill'){readableManual(c,b.manualId);const patch={name:b.name,manualId:b.manualId,archivedAt:b.archived?c.now:null};if(!b.id)return putRecord(tx,c,table,makeRecord(c,patch));const old=await getRecord<SkillDefinition>(tx,c,table,b.id);expectVersion(old,b.version);return putRecord(tx,c,table,revise(c,old,patch),old)}
  if(b.action==='setLevel'){
   person(c,b.employeeId);if(b.employeeId===c.selfId)deny('본인 숙련도는 다른 담당자가 확인해 주세요.');const skill=await getRecord<SkillDefinition>(tx,c,'hr_skill_definitions',b.skillId);if(skill.archivedAt)throw new HrError(409,'보관된 업무예요. 사용할 업무를 다시 선택해 주세요.');readableManual(c,skill.manualId,[b.employeeId]);
   const old=(await listRecords<SkillRecord>(tx,c,table)).find(r=>r.employeeId===b.employeeId&&r.skillId===b.skillId);if(b.id&&old?.id!==b.id)notFound();if(old)expectVersion(old,b.version);
   const patch={employeeId:b.employeeId,skillId:b.skillId,level:b.level,note:b.note,checkedBy:c.userId,checkedAt:c.now,reviewRequestedAt:null};return putRecord(tx,c,table,old?revise(c,old,patch):makeRecord(c,patch),old);
  }
  if(b.action==='requestReview'){const old=await getRecord<SkillRecord>(tx,c,table,b.id);if(old.employeeId!==c.selfId)deny();expectVersion(old,b.version);return putRecord(tx,c,table,revise(c,old,{reviewRequestedAt:c.now}),old)}
  const old=await getRecord<BuddyAssignment>(tx,c,table,b.id);expectVersion(old,b.version);
  if(b.action==='reassignBuddy'){if(c.access!=='owner')deny('교육 담당자 변경은 사장님에게 부탁해 주세요.');person(c,b.buddyId);if(b.buddyId===old.employeeId)throw new HrError(400,'서로 다른 담당자를 선택해 주세요.');for(const s of old.steps)readableManual(c,s.manualId,[old.employeeId,b.buddyId]);return putRecord(tx,c,table,revise(c,old,{buddyId:b.buddyId}),old)}
  const step=old.steps.find(s=>s.id===b.stepId);if(!step)notFound();let changed;
  if(b.action==='ackStep'){if(old.employeeId!==c.selfId)deny();if(step.progress!=='awaiting_ack')throw new HrError(409,'담당자의 확인 요청 후 완료할 수 있어요.');changed={...step,progress:'done' as const,staffAckAt:c.now}}
  else{if(!(c.access==='owner'||(old.buddyId===c.selfId&&buddyActive(c,old)))||old.employeeId===c.selfId)deny();changed={...step,progress:b.progress,note:b.note,noteByEmployeeId:c.selfId,noteBy:c.userId,staffAckAt:null}}
  return putRecord(tx,c,table,revise(c,old,{steps:old.steps.map(s=>s.id===step.id?changed:s)}),old);
 });
}
