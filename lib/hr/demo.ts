import {normalizeTeam,newMember} from '../team-model';
import {HR_SCOPES,type HrGrant,type Candidate,type BuddyAssignment,type SkillDefinition,type SkillRecord,type WorkPreference,type Meeting,type MeetingAction,type MeetingComment,type HrCase,type CaseMessage,type PulseCampaign,type PulseAnswer,type ItemAssignment,type ItemEvent,type HrMeta} from './types';
import type {StoreData} from '../store-data';
export type HrDemoState={store:StoreData;grants:HrGrant[];candidates:Candidate[];buddies:BuddyAssignment[];skills:SkillDefinition[];skillRecords:SkillRecord[];preferences:WorkPreference[];meetings:Meeting[];meetingActions:MeetingAction[];meetingComments:MeetingComment[];cases:HrCase[];caseMessages:CaseMessage[];campaigns:PulseCampaign[];answers:PulseAnswer[];items:ItemAssignment[];itemEvents:ItemEvent[];storeVersion:number;candidateRetentionDays:number|null};
export function createHrDemo():HrDemoState{
 const now=new Date().toISOString(),day=new Date(Date.now()+9*3600000).toISOString().slice(0,10),month=day.slice(0,7);
 const meta=(id:string):HrMeta=>({id,ownerId:'demo-owner',branchId:'branch-main',createdBy:'demo-owner',createdAt:now,updatedAt:now,version:1});
 const store=normalizeTeam(undefined) as StoreData;store.store={name:'척척카페 · 예시 매장',branch:'성수점'};store.branches=[{id:'branch-main',name:'성수점',address:'예시 주소',hours:{open:'09:00',close:'22:00'}}];store.attendance=[];store.adjustments={};store.payrollRuns={};store.requests=[];
 store.employees=[{...newMember(),id:'demo-staff',name:'김민지',role:'바리스타',status:'재직',joined:day},{...newMember(),id:'demo-manager',name:'이준호',role:'매니저',access:'중간관리자',status:'재직',joined:day}];
 store.shifts=[{id:'demo-shift',employeeId:'demo-staff',date:day,start:'17:00',end:'22:00',breakMinutes:30,branchId:'branch-main'}];store._manuals=[{id:'demo-manual',title:'오픈 준비 순서',branchId:'branch-main',steps:[{text:'기기 전원과 매장 청결을 확인해요.'}],updatedAt:now}];
 return {store,storeVersion:1,candidateRetentionDays:null,
  grants:HR_SCOPES.filter(s=>s!=='cases'&&s!=='hiring').map(s=>({...meta('demo-grant-'+s),employeeId:'demo-manager',scope:s,validUntil:null,revokedAt:null})),
  candidates:[{...meta('demo-candidate'),name:'박서연',phone:'',role:'바리스타',availability:'수·금 오후',source:'직접 지원',stage:'면접 예정',interviewAt:now,questions:'가능한 요일을 함께 확인해요.',convertedEmployeeId:null,closedAt:null}],
  buddies:[{...meta('demo-buddy'),employeeId:'demo-staff',buddyId:'demo-manager',from:day,until:'2099-12-31',steps:[{id:'demo-step',title:'오픈 준비 함께 해보기',manualId:'demo-manual',progress:'awaiting_ack',note:'첫날 함께 연습했어요.',staffAckAt:null}]}],
  skills:[{...meta('demo-skill'),name:'음료 준비',manualId:null,archivedAt:null}],skillRecords:[{...meta('demo-level'),employeeId:'demo-staff',skillId:'demo-skill',level:'교육 중',checkedBy:'demo-owner',checkedAt:now,note:'함께 연습하고 다시 확인해요.',reviewRequestedAt:null}],
  preferences:[{...meta('demo-preference'),employeeId:'demo-staff',period:'month',periodKey:month,unit:'hours',min:20,max:40,reviewedAt:null,reviewedBy:null,reviewNote:''}],
  meetings:[{...meta('demo-meeting'),employeeId:'demo-staff',assigneeId:'owner',scheduledAt:now,topic:'첫 주 돌아보기',sharedSummary:'오픈 순서를 함께 연습해요.',sharedAt:now,privateNote:'관리자에게만 보이는 예시 메모입니다.',ackAt:null,status:'held'}],meetingActions:[],meetingComments:[],
  cases:[{...meta('demo-case'),employeeId:'demo-staff',assigneeId:null,subject:'교육 시간을 더 갖고 싶어요',status:'received',lastReplyAt:null}],caseMessages:[{...meta('demo-message'),caseId:'demo-case',fromEmployeeId:'demo-staff',fromOwner:false,body:'오픈 순서를 한 번 더 연습하고 싶어요.'}],
  campaigns:[{...meta('demo-campaign'),title:'이번 주 안내는 어땠나요?',questions:[{id:'demo-q1',text:'근무에 필요한 안내가 충분했나요?'}],employeeIds:['demo-staff','demo-manager'],opensAt:new Date(Date.now()-86400000).toISOString(),closesAt:new Date(Date.now()+7*86400000).toISOString(),status:'open'}],answers:[],
  items:[{...meta('demo-item'),employeeId:'demo-staff',name:'유니폼',issued:2,returned:0,lost:0,issuedAt:now,dueAt:null,receivedAt:null,note:'사이즈 M · 예시'}],itemEvents:[{...meta('demo-item-event'),assignmentId:'demo-item',kind:'issue',quantity:2,note:'예시 지급 기록'}]
 };
}
