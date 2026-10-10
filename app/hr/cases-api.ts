import type {HrContext,HrDatabase,HrCase,CaseMessage,CaseView,CasesView} from '../../lib/hr/types';
import {casesSchema} from '../../lib/hr/cases';
import {deny,notFound,HrError,contextView} from './context';
import {currentAssignee} from './people';
import {withHrMutation,fingerprint} from './mutation';
import {getRecord,listRecords,putRecord,makeRecord,revise,expectVersion} from './records';
const manages=(c:HrContext,r:HrCase)=>c.access==='owner'||(r.assigneeId===c.selfId&&r.employeeId!==c.selfId&&!!r.assigneeId&&currentAssignee(c,r.assigneeId,'cases'));
const visible=(c:HrContext,r:HrCase)=>manages(c,r)||r.employeeId===c.selfId;
export function caseView(c:HrContext,r:HrCase,messages:CaseMessage[]):CaseView{if(!visible(c,r))notFound();return{record:{...r,...(r.status!=='closed'&&r.assigneeId&&!currentAssignee(c,r.assigneeId,'cases')?{status:'handover' as const}:{})},messages:messages.filter(m=>m.caseId===r.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))}}
async function view(db:HrDatabase,c:HrContext,id:string){return caseView(c,await getRecord<HrCase>(db,c,'hr_cases',id),await listRecords<CaseMessage>(db,c,'hr_case_messages'))}
export async function casesRead(db:HrDatabase,c:HrContext,url:URL):Promise<CasesView|CaseView>{const id=url.searchParams.get('id');if(id)return view(db,c,id);return{context:contextView(c),cases:(await listRecords<HrCase>(db,c,'hr_cases')).filter(r=>visible(c,r)).map(r=>caseView(c,r,[])).map(v=>({...v,messages:[]}))}}
export async function casesWrite(db:HrDatabase,ctx:HrContext,input:unknown){const b=casesSchema.parse(input),auth=(c:HrContext)=>{if(b.action==='submit'&&!c.selfId)deny('직원 계정에서 본인 이름으로 의견을 남겨 주세요.');if(b.action==='reassign'&&c.access!=='owner')deny();if(['status','reply'].includes(b.action)&&c.access!=='owner'&&!c.selfId)deny()};auth(ctx);
 return withHrMutation<CaseView>(db,ctx,{...b,operation:'cases:'+b.action,fingerprint:await fingerprint(b),authorize:auth,target:r=>r.record.id,replay:view},async(tx,c)=>{
  const checkAssignee=(id:string|null)=>{if(id&&(!currentAssignee(c,id,'cases')||id===c.selfId))throw new HrError(400,'현재 담당자 또는 사장님을 선택해 주세요.')};
  if(b.action==='submit'){checkAssignee(b.assigneeId);const r=await putRecord(tx,c,'hr_cases',makeRecord(c,{employeeId:c.selfId!,assigneeId:b.assigneeId,subject:b.subject,status:'received' as const,lastReplyAt:null}));await putRecord(tx,c,'hr_case_messages',makeRecord(c,{caseId:r.id,fromEmployeeId:c.selfId,fromOwner:false,body:b.body}));return view(tx,c,r.id)}
  const old=await getRecord<HrCase>(tx,c,'hr_cases',b.id);if(!visible(c,old)){if(old.assigneeId===c.selfId)deny();notFound()}const manage=manages(c,old);if(b.action==='status'&&!manage)deny();expectVersion(old,b.version);let patch:Partial<HrCase>={};
  if(b.action==='reply'){if(old.status==='closed')throw new HrError(409,'마무리한 상담이에요. 재문의 후 답변을 남겨 주세요.');const messages=(await listRecords<CaseMessage>(tx,c,'hr_case_messages')).filter(m=>m.caseId===old.id);if(messages.length>=200)throw new HrError(400,'대화 한도에 도달했어요. 새 상담을 남겨 주세요.');await putRecord(tx,c,'hr_case_messages',makeRecord(c,{caseId:old.id,fromEmployeeId:c.selfId,fromOwner:c.access==='owner',body:b.body}));patch={lastReplyAt:c.now,status:manage?'answered':old.assigneeId&&!currentAssignee(c,old.assigneeId,'cases')?'handover':'reviewing'}}
  if(b.action==='status')patch={status:b.status};if(b.action==='reassign'){checkAssignee(b.assigneeId);patch={assigneeId:b.assigneeId,status:'reviewing'}}
  if(b.action==='reopen'){if(old.employeeId!==c.selfId)deny();patch={status:old.assigneeId&&!currentAssignee(c,old.assigneeId,'cases')?'handover':'reviewing'}}
  await putRecord(tx,c,'hr_cases',revise(c,old,patch),old);return view(tx,c,old.id);
 });
}
