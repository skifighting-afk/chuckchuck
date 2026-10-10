import {z} from 'zod';
import {changeHistory} from '../../lib/hr/history';
import {createHrDemo,type HrDemoState} from '../../lib/hr/demo';
import {HR_SCOPES,type HrClient,type HrScope,type HrMeta,type HrContextView,type Meeting,type HrCase} from '../../lib/hr/types';
import {hiringSchema,candidatePurgeAt} from '../../lib/hr/hiring';
import {trainingSchema} from '../../lib/hr/training';
import {staffingSchema,staffingPeriod,staffingSummary} from '../../lib/hr/staffing';
import {meetingsSchema} from '../../lib/hr/meetings';
import {casesSchema} from '../../lib/hr/cases';
import {pulseSchema,pulseSummary} from '../../lib/hr/pulse';
import {itemsSchema} from '../../lib/hr/items';
import {grantSchema,commandSchema} from '../../lib/hr/schemas';
import {newMember} from '../../lib/team-model';
import {HrApiError} from './client';
export {createHrDemo};
export function createHrDemoClient(state:HrDemoState,role:'owner'|'employee'|'manager'):HrClient{
 const self=role==='owner'?null:role==='employee'?'demo-staff':'demo-manager',uid=self||'demo-owner',cache=new Map<string,{body:string;result:unknown}>();
 let s=state,selfExport=false;
 const fail=(status=403,message='이 역할에서는 이 기록을 처리할 수 없어요.'):never=>{throw new HrApiError(message,status)};
 const now=()=>new Date().toISOString(),day=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 const manage=(scope:HrScope)=>!selfExport&&(role==='owner'||s.grants.some(g=>g.employeeId===self&&g.scope===scope&&!g.revokedAt&&(!g.validUntil||Date.parse(g.validUntil)>Date.now())));
 const must=(scope:HrScope)=>{if(!manage(scope))fail()};
 const owner=()=>{if(role!=='owner')fail()};
 const person=(id:string)=>s.store.employees.find(e=>e.id===id&&!e.anonymizedAt&&e.status!=='퇴사')||fail(404,'직원을 다시 선택해 주세요.');
 const get=<T extends HrMeta>(list:T[],id:string):T=>list.find(r=>r.id===id&&r.branchId==='branch-main')||fail(404,'기록을 찾을 수 없어요.');
 const version=(r:HrMeta,v?:number)=>{if(r.version!==v)fail(409,'다른 곳에서 바뀐 기록이에요. 입력은 남아 있어요. 최신 기록을 확인하고 다시 저장해 주세요.')};
 const meta=():HrMeta=>({id:crypto.randomUUID(),ownerId:'demo-owner',branchId:'branch-main',createdBy:uid,createdAt:now(),updatedAt:now(),version:1});
 const add=<T extends object>(list:(T&HrMeta)[],data:T)=>{const r={...meta(),...data};list.push(r);return r};
 const change=<T extends HrMeta>(r:T,patch:Partial<T>)=>Object.assign(r,{changes:changeHistory({now:now(),userId:uid,selfId:self},r,patch)},patch,{version:r.version+1,updatedAt:now()});
 const ctx=():HrContextView=>({access:role,coowner:false,selfId:self,branchId:'branch-main',storeName:s.store.store.name,branches:s.store.branches.map(({id,name})=>({id,name})),employees:s.store.employees.filter(e=>role==='owner'||HR_SCOPES.some(manage)||e.id===self).map(({id,name,role})=>({id,name,role})),receivers:s.store.employees.filter(e=>s.grants.some(g=>g.employeeId===e.id&&g.scope==='cases'&&!g.revokedAt&&(!g.validUntil||Date.parse(g.validUntil)>Date.now()))).map(({id,name})=>({id,name})),scopes:HR_SCOPES.filter(manage)});
 const meetingManage=(m:Meeting)=>role==='owner'||m.employeeId!==self&&m.assigneeId===self&&manage('meetings');
 const meetingView=(m:Meeting)=>{const editable=meetingManage(m);if(!editable&&!(m.employeeId===self&&m.sharedAt))fail(404);const {privateNote,...meeting}=m;return{meeting,...(editable?{privateNote}:{}),actions:s.meetingActions.filter(a=>a.meetingId===m.id),comments:s.meetingComments.filter(a=>a.meetingId===m.id),editable,handover:false}};
 const caseManage=(c:HrCase)=>role==='owner'||c.employeeId!==self&&c.assigneeId===self&&manage('cases');
 const caseView=(c:HrCase,detail=true)=>{if(!caseManage(c)&&c.employeeId!==self)fail(404);return{record:c,messages:detail?s.caseMessages.filter(m=>m.caseId===c.id):[]}};
 const read=(path:string):any=>{
  const u=new URL(path,'https://demo.invalid'),scope=u.pathname.split('/').at(-1);if(u.searchParams.has('branch')&&u.searchParams.get('branch')!=='branch-main')fail(404);
  if(scope==='context')return ctx();
  if(scope==='grants'){owner();return{grants:s.grants}}
  if(scope==='hiring'){must('hiring');return{candidates:s.candidates,owner:role==='owner',storeVersion:s.storeVersion,employees:s.store.employees.map(({id,name})=>({id,name})),candidateRetentionDays:s.candidateRetentionDays,deletionPreview:s.candidates.flatMap(c=>{const purgeAt=candidatePurgeAt(c,s.candidateRetentionDays);return purgeAt?[{id:c.id,name:c.name,purgeAt}]:[]})}}
  if(scope==='training'){const m=manage('training'),buddies=s.buddies.filter(a=>role==='owner'||a.employeeId===self||a.buddyId===self&&a.from<=day()&&a.until>=day()).map(a=>({...a,handover:false}));return{context:ctx(),manage:m,buddies,skills:s.skills,records:s.skillRecords.filter(r=>m||r.employeeId===self),manuals:(s.store._manuals||[]).map(({id,title})=>({id,title})),people:s.store.employees.filter(e=>m||e.id===self||buddies.some(b=>b.buddyId===e.id||b.employeeId===e.id)).map(({id,name})=>({id,name})),legacySkills:[]}}
  if(scope==='staffing'){const period=u.searchParams.get('period')==='week'?'week':'month',periodKey=u.searchParams.get('key')||day().slice(0,7),r=staffingPeriod(period,periodKey,s.store.settings.weekStart||'mon'),preferences=s.preferences.filter(p=>(manage('staffing')||p.employeeId===self)&&p.period===period&&p.periodKey===periodKey),rows=staffingSummary(s.store,preferences,'branch-main',r.from,r.to).filter(row=>manage('staffing')||row.employeeId===self),ids=new Set(rows.flatMap(r=>r.evidenceShiftIds));return{context:ctx(),manage:manage('staffing'),period,periodKey,...r,preferences,rows,evidence:s.store.shifts.filter(sh=>ids.has(sh.id)),selfAllBranchHours:self?rows.find(r=>r.employeeId===self)?.plannedHours||0:null,unconfirmedSkills:[]}}
  if(scope==='meetings')return{context:ctx(),manage:manage('meetings'),assignees:[{id:'owner',name:'사장님·공동관리자'},...s.store.employees.filter(e=>s.grants.some(g=>g.employeeId===e.id&&g.scope==='meetings'&&!g.revokedAt)).map(({id,name})=>({id,name}))],meetings:s.meetings.filter(m=>meetingManage(m)||m.employeeId===self&&m.sharedAt).map(meetingView)};
  if(scope==='cases')return u.searchParams.has('id')?caseView(get(s.cases,u.searchParams.get('id')!)):{context:ctx(),cases:s.cases.filter(c=>caseManage(c)||c.employeeId===self).map(c=>caseView(c,false))};
  if(scope==='pulse'){const m=manage('pulse');return{context:ctx(),manage:m,campaigns:s.campaigns.filter(c=>m||c.status!=='draft'&&c.employeeIds.includes(self!)).map(c=>({campaign:m?c:{...c,employeeIds:[self!]},answers:s.answers.filter(a=>a.campaignId===c.id&&(m||a.employeeId===self)),summary:m?pulseSummary(c,s.answers):null}))}}
  if(scope==='items'){const employee=u.searchParams.get('employee');if(employee&&!manage('items')&&employee!==self)fail();const items=s.items.filter(i=>(manage('items')||i.employeeId===self)&&(!employee||i.employeeId===employee));return{context:ctx(),manage:manage('items'),items,events:s.itemEvents.filter(e=>items.some(i=>i.id===e.assignmentId)),people:s.store.employees.filter(e=>manage('items')||e.id===self).map(({id,name})=>({id,name,departed:false}))}}
  fail(404);
 };
 const mutate=(scope:string,input:unknown):any=>{
  const schemas:Record<string,z.ZodTypeAny>={hiring:hiringSchema,training:trainingSchema,staffing:staffingSchema,meetings:meetingsSchema,cases:casesSchema,pulse:pulseSchema,items:itemsSchema,grants:grantSchema,export:commandSchema.extend({action:z.literal('export'),mode:z.enum(['self','owner']),selection:z.array(z.enum(HR_SCOPES)).min(1)})};
  const schema=schemas[scope];if(!schema)fail(404);const parsed=schema.safeParse(input);if(!parsed.success)fail(400,parsed.error.issues[0]?.message||'입력 내용을 확인해 주세요.');const b:any=parsed.data;
  if(b.branchId!=='branch-main')fail(404);
  if(scope==='hiring'){
   must('hiring');if(b.action==='retentionSettings'){owner();s.candidateRetentionDays=b.candidateRetentionDays;return{candidateRetentionDays:s.candidateRetentionDays}}
   if(b.action==='save'){const patch={name:b.name,phone:b.phone,role:b.role,availability:b.availability,source:b.source,questions:b.questions};if(!b.id)return add(s.candidates,{...patch,stage:'지원 접수' as const,interviewAt:null,convertedEmployeeId:null,closedAt:null});const c=get(s.candidates,b.id);version(c,b.version);if(c.convertedEmployeeId)fail(409);return change(c,patch)}
   const c=get(s.candidates,b.id);version(c,b.version);
   if(b.action==='convert'){owner();if(c.stage!=='채용 결정'||c.convertedEmployeeId||s.storeVersion!==b.storeVersion)fail(409);let e;if(b.mode==='new'){e={...newMember(),id:crypto.randomUUID(),name:c.name,role:c.role,phone:c.phone,status:'입사 준비' as const,wage:0,autoPay:false};s.store.employees.push(e)}else e=person(b.employeeId);s.storeVersion++;return change(c,{convertedEmployeeId:e.id})}
   return change(c,b.action==='archive'?{stage:'종료',closedAt:now()}:{stage:b.stage,interviewAt:b.interviewAt,closedAt:['종료','지원 철회'].includes(b.stage)?now():null});
  }
  if(scope==='training'){
   if(['assignBuddy','reassignBuddy','saveSkill','setLevel'].includes(b.action))must('training');
   if(b.action==='assignBuddy'){if(role!=='owner'&&b.buddyId!==self)fail();person(b.employeeId);person(b.buddyId);if(b.employeeId===b.buddyId||b.until<b.from)fail(400);return add(s.buddies,{employeeId:b.employeeId,buddyId:b.buddyId,from:b.from,until:b.until,steps:b.steps.map((st:any)=>({...st,id:crypto.randomUUID(),progress:'todo',note:'',staffAckAt:null}))})}
   if(b.action==='saveSkill'){const patch={name:b.name,manualId:b.manualId,archivedAt:b.archived?now():null};if(!b.id)return add(s.skills,patch);const r=get(s.skills,b.id);version(r,b.version);return change(r,patch)}
   if(b.action==='setLevel'){person(b.employeeId);get(s.skills,b.skillId);if(b.employeeId===self)fail();const r=s.skillRecords.find(r=>r.employeeId===b.employeeId&&r.skillId===b.skillId),patch={employeeId:b.employeeId,skillId:b.skillId,level:b.level,note:b.note,checkedBy:uid,checkedAt:now(),reviewRequestedAt:null};if(r){version(r,b.version);return change(r,patch)}return add(s.skillRecords,patch)}
   if(b.action==='requestReview'){const r=get(s.skillRecords,b.id);if(r.employeeId!==self)fail();version(r,b.version);return change(r,{reviewRequestedAt:now()})}
   const a=get(s.buddies,b.id);version(a,b.version);if(b.action==='reassignBuddy'){owner();person(b.buddyId);if(a.employeeId===b.buddyId)fail(400);return change(a,{buddyId:b.buddyId})}
   const st=a.steps.find(st=>st.id===b.stepId)||fail(404);if(b.action==='ackStep'){if(a.employeeId!==self)fail();if(st.progress!=='awaiting_ack')fail(409);st.progress='done';st.staffAckAt=now()}else{if(a.employeeId===self||role!=='owner'&&!(a.buddyId===self&&a.from<=day()&&a.until>=day()))fail();Object.assign(st,{progress:b.progress,note:b.note,staffAckAt:null})}return change(a,{});
  }
  if(scope==='staffing'){
   if(b.action==='reviewPreference'){must('staffing');const r=get(s.preferences,b.id);version(r,b.version);return change(r,{reviewedAt:now(),reviewedBy:uid,reviewNote:b.reviewNote})}
   if(!self||b.employeeId&&b.employeeId!==self)fail();const range=staffingPeriod(b.period,b.periodKey,s.store.settings.weekStart||'mon'),max=b.unit==='hours'?(b.period==='week'?168:744):(b.period==='week'?7:Number(range.to.slice(8)));if(b.min>b.max||b.max>max||b.unit==='days'&&(!Number.isInteger(b.min)||!Number.isInteger(b.max)))fail(400);
   const r=s.preferences.find(p=>p.employeeId===self&&p.period===b.period&&p.periodKey===b.periodKey),patch={employeeId:self!,period:b.period,periodKey:b.periodKey,unit:b.unit,min:b.min,max:b.max,reviewedAt:null,reviewedBy:null,reviewNote:''};if(r){version(r,b.version);return change(r,patch)}return add(s.preferences,patch);
  }
  if(scope==='meetings'){
   if(b.action==='save'){must('meetings');person(b.employeeId);if(b.employeeId===self||role!=='owner'&&b.assigneeId!==self)fail();const patch={employeeId:b.employeeId,assigneeId:b.assigneeId,scheduledAt:b.scheduledAt,topic:b.topic,sharedSummary:b.sharedSummary,privateNote:b.privateNote,status:b.status,sharedAt:null,ackAt:null};if(b.id){const m=get(s.meetings,b.id);if(!meetingManage(m))fail(404);version(m,b.version);change(m,patch);return meetingView(m)}return meetingView(add(s.meetings,patch))}
   const m=get(s.meetings,b.meetingId||b.id);meetingView(m);version(m,b.version);
   if(['share','action','reassign'].includes(b.action)&&!meetingManage(m))fail();
   if(b.action==='share'){if(!m.sharedSummary.trim())fail(400);m.sharedAt=now();m.ackAt=null}
   if(b.action==='ack'){if(m.employeeId!==self||!m.sharedAt)fail();m.ackAt=now()}
   if(b.action==='comment'){if(!m.sharedAt)fail(409);add(s.meetingComments,{meetingId:m.id,body:b.body})}
   if(b.action==='reassign'){owner();m.assigneeId=b.assigneeId}
   if(b.action==='action'){person(b.employeeId);if(b.employeeId!==m.employeeId&&b.employeeId!==m.assigneeId)fail(400,'면담 참여자에게 배정해 주세요.');const old=b.id?get(s.meetingActions,b.id):null;if(old){if(old.meetingId!==m.id)fail(404);version(old,b.actionVersion)}const patch={meetingId:m.id,text:b.text,employeeId:b.employeeId,due:b.due,status:old?.status||'open' as const,completedAt:old?.completedAt||null,history:[...(old?.history||[]),...(!old||old.due!==b.due?[{due:b.due,at:now(),by:uid}]:[])]};old?change(old,patch):add(s.meetingActions,patch)}
   if(b.action==='actionComplete'){const a=get(s.meetingActions,b.id);if(a.meetingId!==m.id)fail(404);if(!meetingManage(m)&&a.employeeId!==self)fail();version(a,b.actionVersion);change(a,{status:'done',completedAt:now()})}
   change(m,{});return meetingView(m);
  }
  if(scope==='cases'){
   if(b.action==='submit'){if(!self)fail();const c=add(s.cases,{employeeId:self!,assigneeId:b.assigneeId,subject:b.subject,status:'received' as const,lastReplyAt:null});add(s.caseMessages,{caseId:c.id,fromEmployeeId:self,fromOwner:false,body:b.body});return caseView(c)}
   const c=get(s.cases,b.id);caseView(c);version(c,b.version);
   if(b.action==='reply'){if(c.status==='closed')fail(409);add(s.caseMessages,{caseId:c.id,fromEmployeeId:self,fromOwner:role==='owner',body:b.body});change(c,{lastReplyAt:now(),status:caseManage(c)?'answered':'reviewing'})}
   if(b.action==='status'){if(!caseManage(c))fail();change(c,{status:b.status})}if(b.action==='reassign'){owner();change(c,{assigneeId:b.assigneeId,status:'reviewing'})}if(b.action==='reopen'){if(c.employeeId!==self)fail();change(c,{status:'reviewing'})}return caseView(c);
  }
  if(scope==='pulse'){
   if(b.action!=='answer')must('pulse');
   if(b.action==='saveCampaign'){if(Date.parse(b.opensAt)>=Date.parse(b.closesAt))fail(400);b.employeeIds.forEach(person);const patch={title:b.title,questions:b.questions,employeeIds:b.employeeIds,opensAt:b.opensAt,closesAt:b.closesAt,status:'draft' as const};if(!b.id)return add(s.campaigns,patch);const c=get(s.campaigns,b.id);version(c,b.version);if(c.status!=='draft')fail(409);return change(c,patch)}
   const c=get(s.campaigns,b.campaignId||b.id);
   if(b.action==='answer'){if(!self||!c.employeeIds.includes(self))fail();if(c.status!=='open'||Date.now()<Date.parse(c.opensAt)||Date.now()>=Date.parse(c.closesAt))fail(409);if(c.questions.some(q=>![1,2,3,4,5].includes(b.values[q.id])))fail(400);const r=s.answers.find(a=>a.campaignId===c.id&&a.employeeId===self),patch={campaignId:c.id,employeeId:self!,values:b.values,comment:b.comment,submittedAt:now()};if(r){version(r,b.version);return change(r,patch)}return add(s.answers,patch)}
   version(c,b.version);if(b.action==='publish'&&c.status!=='draft'||b.action==='close'&&c.status!=='open')fail(409);return change(c,{status:b.action==='publish'?'open':'closed'});
  }
  if(scope==='items'){
   let r,quantity=0;if(b.action!=='ack')must('items');if(b.action==='issue'){person(b.employeeId);quantity=b.quantity;r=add(s.items,{employeeId:b.employeeId,name:b.name,issued:quantity,returned:0,lost:0,issuedAt:now(),dueAt:b.dueAt,receivedAt:null,note:b.note})}
   else{r=get(s.items,b.id);if(b.action==='ack'&&r.employeeId!==self)fail();version(r,b.version);if(b.action==='ack'){if(r.receivedAt)fail(409);change(r,{receivedAt:now()})}if(b.action==='requestReturn')change(r,{dueAt:b.dueAt});if(b.action==='return'||b.action==='lost'){quantity=b.quantity;if(quantity>r.issued-r.returned-r.lost)fail(409);change(r,b.action==='return'?{returned:r.returned+quantity}:{lost:r.lost+quantity})}}
   add(s.itemEvents,{assignmentId:r.id,kind:b.action,quantity,note:b.note||''});return r;
  }
  if(scope==='grants'){owner();if(b.action==='grant'){person(b.employeeId);return add(s.grants,{employeeId:b.employeeId,scope:b.scope,validUntil:b.validUntil,revokedAt:null})}const g=get(s.grants,b.id);version(g,b.version);return change(g,{revokedAt:now()})}
  if(scope==='export'){
   if(b.mode==='owner')owner();else if(!self||b.selection.includes('hiring'))fail();const sections:Record<string,unknown>={};selfExport=b.mode==='self';try{for(const scope of b.selection){const view=read('/api/hr/'+scope);if(scope==='training'&&selfExport)view.buddies=view.buddies.filter((a:any)=>a.employeeId===self);if(scope==='meetings')sections[scope]=view.meetings.map((v:any)=>{if(b.mode==='owner')return v;const {privateNote,...safe}=v;return safe});else sections[scope]=view}}finally{selfExport=false}return{generatedAt:now(),ownerId:'demo-owner',branchId:'branch-main',mode:b.mode,sections};
  }
  fail(404);
 };
 return{get:async<T>(path:string)=>structuredClone(read(path)) as T,post:async<T>(path:string,body:unknown)=>{
  const b=body as any,key=uid+':'+b?.requestId,encoded=JSON.stringify({path,body}),prior=cache.get(key),scope=path.split('?')[0].split('/').at(-1)!;
  if(prior){if(prior.body!==encoded)fail(409);if(['hiring','grants'].includes(scope))scope==='grants'?owner():must('hiring');return structuredClone({...prior.result as object,replayed:true}) as T}
  const original=s;s=structuredClone(state);try{const record=mutate(scope,body),result={record,replayed:false};Object.assign(state,s);cache.set(key,{body:encoded,result:structuredClone(result)});return structuredClone(result) as T}finally{s=original}
 }};
}
