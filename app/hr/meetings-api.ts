import type {HrContext,HrDatabase,Meeting,MeetingAction,MeetingComment,MeetingView,MeetingsView} from '../../lib/hr/types';
import {meetingsSchema} from '../../lib/hr/meetings';
import {deny,notFound,HrError,contextView} from './context';
import {isManager,person,currentAssignee,activePeople} from './people';
import {listRecords,getRecord,makeRecord,revise,putRecord,expectVersion} from './records';
import {withHrMutation,fingerprint} from './mutation';
export const managesMeeting=(c:HrContext,m:Meeting)=>c.access==='owner'||(m.employeeId!==c.selfId&&m.assigneeId===c.selfId&&currentAssignee(c,m.assigneeId,'meetings'));
export function meetingView(c:HrContext,m:Meeting,actions:MeetingAction[],comments:MeetingComment[]):MeetingView{
 const manage=managesMeeting(c,m);if(!manage&&!(m.employeeId===c.selfId&&m.sharedAt))notFound();const {privateNote,...meeting}=m;
 return{meeting,...(manage?{privateNote}:{}),actions:actions.filter(a=>a.meetingId===m.id),comments:comments.filter(a=>a.meetingId===m.id)};
}
async function view(db:HrDatabase,c:HrContext,id:string){return meetingView(c,await getRecord<Meeting>(db,c,'hr_meetings',id),await listRecords<MeetingAction>(db,c,'hr_meeting_actions'),await listRecords<MeetingComment>(db,c,'hr_meeting_comments'))}
export async function meetingsRead(db:HrDatabase,c:HrContext):Promise<MeetingsView>{const meetings=await listRecords<Meeting>(db,c,'hr_meetings'),actions=await listRecords<MeetingAction>(db,c,'hr_meeting_actions'),comments=await listRecords<MeetingComment>(db,c,'hr_meeting_comments');return{context:contextView(c),manage:isManager(c,'meetings'),assignees:[{id:'owner',name:'사장님·공동관리자'},...activePeople(c).filter(e=>currentAssignee(c,e.id,'meetings')).map(e=>({id:e.id,name:e.name}))],meetings:meetings.filter(m=>managesMeeting(c,m)||(m.employeeId===c.selfId&&m.sharedAt)).map(m=>({...meetingView(c,m,actions,comments),editable:managesMeeting(c,m),handover:m.assigneeId!=='owner'&&!currentAssignee(c,m.assigneeId,'meetings')}))}}
export async function meetingsWrite(db:HrDatabase,ctx:HrContext,input:unknown){const b=meetingsSchema.parse(input),manageActions=['save','share','action','reassign'],auth=(c:HrContext)=>{if(manageActions.includes(b.action)&&!isManager(c,'meetings'))deny()};auth(ctx);
 return withHrMutation<MeetingView>(db,ctx,{...b,operation:'meetings:'+b.action,fingerprint:await fingerprint(b),authorize:auth,target:r=>r.meeting.id,replay:view},async(tx,c)=>{
  const assignee=(id:string)=>{if(id!=='owner'&&!currentAssignee(c,id,'meetings'))throw new HrError(400,'현재 면담 권한이 있는 담당자를 선택해 주세요.');if(c.access!=='owner'&&id!==c.selfId)deny()};
  if(b.action==='save'){
   person(c,b.employeeId);assignee(b.assigneeId);if(b.employeeId===c.selfId)deny('본인 면담 기록은 다른 담당자에게 부탁해 주세요.');let old:Meeting|undefined;if(b.id){old=await getRecord<Meeting>(tx,c,'hr_meetings',b.id);if(!managesMeeting(c,old))notFound();expectVersion(old,b.version);if(old.employeeId!==b.employeeId)throw new HrError(400,'면담 직원은 바꿀 수 없어요. 새 면담을 만들어 주세요.')}
   const patch={employeeId:b.employeeId,assigneeId:b.assigneeId,scheduledAt:b.scheduledAt,topic:b.topic,sharedSummary:b.sharedSummary,privateNote:b.privateNote,status:b.status,sharedAt:null,ackAt:null};const m=await putRecord(tx,c,'hr_meetings',old?revise(c,old,patch):makeRecord(c,patch),old);return view(tx,c,m.id);
  }
  const id='meetingId'in b?b.meetingId:b.id,old=await getRecord<Meeting>(tx,c,'hr_meetings',id),manage=managesMeeting(c,old);if(manageActions.includes(b.action)&&!manage)notFound();if(!manage&&!(old.employeeId===c.selfId&&old.sharedAt))notFound();expectVersion(old,b.version);let patch:Partial<Meeting>={};
  if(b.action==='share'){if(!old.sharedSummary.trim())throw new HrError(400,'직원에게 공유할 요약을 먼저 저장해 주세요.');patch={sharedAt:c.now,ackAt:null}}
  if(b.action==='ack'){if(old.employeeId!==c.selfId||!old.sharedAt)deny();patch={ackAt:c.now}}
  if(b.action==='reassign'){if(c.access!=='owner')deny();assignee(b.assigneeId);patch={assigneeId:b.assigneeId}}
  if(b.action==='comment'){if(!old.sharedAt)throw new HrError(409,'공유한 뒤 대화를 남길 수 있어요.');const comments=(await listRecords<MeetingComment>(tx,c,'hr_meeting_comments')).filter(r=>r.meetingId===old.id);if(comments.length>=200)throw new HrError(400,'대화 한도에 도달했어요. 새 면담을 만들어 주세요.');await putRecord(tx,c,'hr_meeting_comments',makeRecord(c,{meetingId:old.id,body:b.body}))}
  if(b.action==='action'){
   person(c,b.employeeId);const rows=(await listRecords<MeetingAction>(tx,c,'hr_meeting_actions')).filter(r=>r.meetingId===old.id),a=b.id?rows.find(r=>r.id===b.id):undefined;if(b.id&&!a)notFound();if(a)expectVersion(a,b.actionVersion);else if(rows.length>=20)throw new HrError(400,'약속은 면담당 20개까지 기록할 수 있어요.');const history=[...(a?.history||[]),...(!a||a.due!==b.due?[{due:b.due,at:c.now,by:c.userId}]:[])];if(history.length>100)throw new HrError(400,'기한 변경 한도에 도달했어요. 새 약속을 만들어 주세요.');const p={meetingId:old.id,text:b.text,employeeId:b.employeeId,due:b.due,status:a?.status||'open' as const,completedAt:a?.completedAt||null,history};await putRecord(tx,c,'hr_meeting_actions',a?revise(c,a,p):makeRecord(c,p),a);
  }
  if(b.action==='actionComplete'){const a=await getRecord<MeetingAction>(tx,c,'hr_meeting_actions',b.id);if(a.meetingId!==old.id)notFound();if(!manage&&a.employeeId!==c.selfId)deny();if(!manage&&!old.sharedAt)deny();expectVersion(a,b.actionVersion);await putRecord(tx,c,'hr_meeting_actions',revise(c,a,{status:'done',completedAt:c.now}),a)}
  await putRecord(tx,c,'hr_meetings',revise(c,old,patch),old);return view(tx,c,old.id);
 });
}
