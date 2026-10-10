import {z} from 'zod';import {HR_SCOPES,type HrScope,type HrContext,type HrDatabase,type HrExport,type HrCase,type CaseMessage,type WorkPreference} from '../../lib/hr/types';import {commandSchema} from '../../lib/hr/schemas';import {deny} from './context';import {hiringRead} from './hiring-api';import {trainingRead} from './training-api';import {meetingsRead} from './meetings-api';import {caseView} from './cases-api';import {pulseRead} from './pulse-api';import {itemsRead} from './items-api';import {listRecords} from './records';import {withHrMutation,fingerprint} from './mutation';
const schema=commandSchema.extend({action:z.literal('export'),mode:z.enum(['self','owner']),selection:z.array(z.enum(HR_SCOPES)).min(1).max(7)});
export async function exportHrData(db:HrDatabase,ctx:HrContext,selection:HrScope[],mode:'self'|'owner'):Promise<HrExport>{
 if(mode==='owner'&&ctx.access!=='owner')deny();if(mode==='self'&&!ctx.selfId)deny('직원 본인 계정에서 내려받아 주세요.');if(mode==='self'&&selection.includes('hiring'))deny();
 const c=mode==='self'?{...ctx,access:'employee' as const,coowner:false,grants:[]}:ctx,sections:HrExport['sections']={};
 for(const s of new Set(selection)){
  if(s==='hiring')sections.hiring=(await hiringRead(db,c)).candidates;
  if(s==='training'){const v=await trainingRead(db,c),records=v.records;sections.training={buddies:v.buddies.filter(a=>mode==='owner'||a.employeeId===c.selfId),skills:v.skills.filter(s=>mode==='owner'||records.some(r=>r.skillId===s.id)),records,legacySkills:v.legacySkills}}
  if(s==='staffing')sections.staffing=(await listRecords<WorkPreference>(db,c,'hr_work_preferences')).filter(p=>mode==='owner'||p.employeeId===c.selfId);
  if(s==='meetings')sections.meetings=(await meetingsRead(db,c)).meetings.map(({editable,handover,...v})=>v);
  if(s==='cases'){const rows=await listRecords<HrCase>(db,c,'hr_cases'),messages=await listRecords<CaseMessage>(db,c,'hr_case_messages');sections.cases=rows.filter(r=>mode==='owner'||r.employeeId===c.selfId).map(r=>caseView(c,r,messages))}
  if(s==='pulse'){const v=await pulseRead(db,c,new URL('https://hr.local'));if('campaigns'in v)sections.pulse=v.campaigns}
  if(s==='items'){const v=await itemsRead(db,c,new URL('https://hr.local'));sections.items={items:v.items,events:v.events}}
 }
 return{generatedAt:ctx.now,ownerId:ctx.ownerId,branchId:ctx.branchId,mode,sections};
}
export async function hrExportWrite(db:HrDatabase,ctx:HrContext,input:unknown){const b=schema.parse(input),auth=(c:HrContext)=>{if(b.mode==='owner'&&c.access!=='owner'||b.mode==='self'&&!c.selfId||b.mode==='self'&&b.selection.includes('hiring'))deny()};auth(ctx);return withHrMutation<HrExport>(db,ctx,{...b,operation:'export',fingerprint:await fingerprint(b),authorize:auth,target:()=> 'export',replay:(tx,c)=>exportHrData(tx,c,b.selection,b.mode)},(tx,c)=>exportHrData(tx,c,b.selection,b.mode))}
