import type {HrContext,HrDatabase,HrCase} from '../../lib/hr/types';
import {caseNotification} from '../../lib/hr/cases';
import {contextFromRow} from './context';
import {getRecord} from './records';
import {activePeople,currentAssignee} from './people';
import {notifyUser} from '../push-api';
export async function notifyCaseChange(env:{DB:D1Database},db:HrDatabase,ctx:HrContext,id:string,action:string){
 try{
  const row=await db.prepare('SELECT owner,data,version FROM stores WHERE owner=?').bind(ctx.ownerId).first<any>();if(!row)return;
  const c=await contextFromRow(db,ctx.userId,row,ctx.branchId),r=await getRecord<HrCase>(db,c,'hr_cases',id),members=c.store._members||[],active=new Set(activePeople(c).map(e=>e.id));
  const author=members.find(m=>m.employeeId===r.employeeId&&active.has(m.employeeId))?.userId,assigned=r.assigneeId&&currentAssignee(c,r.assigneeId,'cases')?members.find(m=>m.employeeId===r.assigneeId)?.userId:null;
  const owners=[c.ownerId,...((c.store as any)._coowners||[]).map((o:any)=>o.userId)],targets=(['submit','reopen'].includes(action)||(action==='reply'&&c.selfId===r.employeeId))?[...owners,assigned]:[author,...(action==='reassign'?[assigned]:[])];
  for(const uid of new Set(targets.filter((uid):uid is string=>!!uid&&uid!==ctx.userId)))await notifyUser(env,uid,caseNotification);
 }catch{/* A notification failure never changes the committed HR record. */}
}
