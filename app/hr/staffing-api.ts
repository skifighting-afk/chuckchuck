import type {HrContext,HrDatabase,WorkPreference,StaffingView,SkillRecord,SkillDefinition} from '../../lib/hr/types';
import {staffingSchema,staffingPeriod,staffingSummary} from '../../lib/hr/staffing';
import {shiftHours,weekStartOf} from '../../lib/ops-view';
import {deny,HrError,contextView,notFound} from './context';
import {hrToday,isManager,person,activePeople} from './people';
import {withHrMutation,fingerprint} from './mutation';
import {getRecord,listRecords,makeRecord,revise,putRecord,expectVersion} from './records';
function range(c:HrContext,period:'week'|'month',key:string){try{return staffingPeriod(period,key,c.store.settings.weekStart||'mon')}catch{throw new HrError(400,'대상 기간과 주 시작일을 확인해 주세요.')}}
export async function staffingRead(db:HrDatabase,c:HrContext,url:URL):Promise<StaffingView>{
 const period=url.searchParams.get('period')||'month';if(period!=='week'&&period!=='month')throw new HrError(400,'주 또는 월을 선택해 주세요.');const periodKey=url.searchParams.get('key')||(period==='month'?hrToday(c).slice(0,7):weekStartOf(hrToday(c),c.store.settings.weekStart||'mon')),r=range(c,period,periodKey),manage=isManager(c,'staffing');
 const preferences=(await listRecords<WorkPreference>(db,c,'hr_work_preferences')).filter(p=>(manage||p.employeeId===c.selfId)&&p.period===period&&p.periodKey===periodKey),rows=staffingSummary(c.store,preferences,c.branchId,r.from,r.to).filter(row=>manage||row.employeeId===c.selfId),ids=new Set(rows.flatMap(r=>r.evidenceShiftIds));
 const skills=await listRecords<SkillDefinition>(db,c,'hr_skill_definitions'),records=await listRecords<SkillRecord>(db,c,'hr_skill_records');
 return{context:contextView(c),manage,period,periodKey,...r,preferences,rows,evidence:c.store.shifts.filter(s=>ids.has(s.id)).map(({id,employeeId,date,start,end,breakMinutes})=>({id,employeeId,date,start,end,breakMinutes})),selfAllBranchHours:c.selfId?Math.round(c.store.shifts.filter(s=>s.employeeId===c.selfId&&s.date>=r.from&&s.date<=r.to).reduce((n,s)=>n+shiftHours(s),0)*100)/100:null,unconfirmedSkills:activePeople(c).filter(e=>manage||e.id===c.selfId).flatMap(e=>(e.extra?.skills||[]).filter(tag=>!records.some(rec=>rec.employeeId===e.id&&rec.checkedAt&&skills.find(s=>s.id===rec.skillId)?.name===tag)).map(skill=>({employeeId:e.id,skill})))};
}
export async function staffingWrite(db:HrDatabase,ctx:HrContext,input:unknown){const b=staffingSchema.parse(input),auth=(c:HrContext)=>{if(b.action==='reviewPreference'&&!isManager(c,'staffing'))deny();if(b.action==='savePreference'&&(!c.selfId||(b.employeeId&&b.employeeId!==c.selfId)))deny()};auth(ctx);
 const read=async(tx:HrDatabase,c:HrContext,id:string)=>{const p=await getRecord<WorkPreference>(tx,c,'hr_work_preferences',id);if(!isManager(c,'staffing')&&p.employeeId!==c.selfId)notFound();return p};
 return withHrMutation<WorkPreference>(db,ctx,{...b,operation:'staffing:'+b.action,fingerprint:await fingerprint(b),authorize:auth,target:r=>r.id,replay:read},async(tx,c)=>{
  if(b.action==='reviewPreference'){const old=await getRecord<WorkPreference>(tx,c,'hr_work_preferences',b.id);expectVersion(old,b.version);return putRecord(tx,c,'hr_work_preferences',revise(c,old,{reviewedAt:c.now,reviewedBy:c.userId,reviewNote:b.reviewNote}),old)}
  const employeeId=c.selfId!;person(c,employeeId);const r=range(c,b.period,b.periodKey),max=b.unit==='hours'?(b.period==='week'?168:744):(b.period==='week'?7:Number(r.to.slice(8)));
  if(b.min>b.max||b.max>max||(b.unit==='days'&&(!Number.isInteger(b.min)||!Number.isInteger(b.max))))throw new HrError(400,'희망 범위와 기간별 최대 시간을 확인해 주세요.');
  const old=(await listRecords<WorkPreference>(tx,c,'hr_work_preferences')).find(p=>p.employeeId===employeeId&&p.period===b.period&&p.periodKey===b.periodKey);if(b.id&&old?.id!==b.id)notFound();if(old)expectVersion(old,b.version);
  const patch={employeeId,period:b.period,periodKey:b.periodKey,unit:b.unit,min:b.min,max:b.max,reviewedAt:null,reviewedBy:null,reviewNote:''};return putRecord(tx,c,'hr_work_preferences',old?revise(c,old,patch):makeRecord(c,patch),old);
 });
}
