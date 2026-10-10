import type {HrContext,HrDatabase,Meeting,MeetingAction,ItemAssignment} from '../../lib/hr/types';
import {asHrDatabase,contextFromRow} from './context';
import {listRecords} from './records';
import {activePeople,currentAssignee,hrToday} from './people';
import {notifyUser} from '../push-api';
export async function purgeClosedCandidates(db:HrDatabase,ownerId:string,now:string):Promise<number>{return db.transaction(async tx=>{const store=await tx.prepare('SELECT owner FROM stores WHERE owner=? FOR UPDATE').bind(ownerId).first();if(!store)return 0;const settings=await tx.prepare('SELECT candidate_retention_days AS days FROM hr_settings WHERE owner=?').bind(ownerId).first<any>();if(!settings?.days)return 0;const cut=new Date(Date.parse(now)-Number(settings.days)*86400000).toISOString();const deleted=await tx.prepare("DELETE FROM hr_candidates WHERE owner=? AND data->>'stage' IN ('종료','지원 철회') AND data->>'closedAt'<=?").bind(ownerId,cut).run();return deleted.meta.changes})}
type Due={id:string;branchId:string;kind:'meetings'|'items';employeeId:string;assigneeId?:string};
export async function hrDeadlineSweep(env:{DB:D1Database},now=Date.now(),notify=(uid:string,m:{title:string;body:string;url:string})=>notifyUser(env,uid,m)){
 const db=asHrDatabase(env.DB),owners=(await db.prepare('SELECT owner FROM stores ORDER BY owner').all()).results as {owner:string}[];let purged=0,sent=0;
 for(const {owner} of owners){purged+=await purgeClosedCandidates(db,owner,new Date(now).toISOString());const pending=await db.transaction(async tx=>{
  const row=await tx.prepare('SELECT owner,data,version FROM stores WHERE owner=? FOR UPDATE').bind(owner).first<any>();if(!row)return [];
  const raw=JSON.parse(row.data),tasks:Due[]=[];for(const b of raw.branches||[]){const c={...await contextFromRow(tx,owner,row,b.id),now:new Date(now).toISOString()},today=hrToday(c),meetings=await listRecords<Meeting>(tx,c,'hr_meetings'),actions=await listRecords<MeetingAction>(tx,c,'hr_meeting_actions'),items=await listRecords<ItemAssignment>(tx,c,'hr_item_assignments');
   for(const m of meetings.filter(m=>m.status==='scheduled'&&new Date(Date.parse(m.scheduledAt)+9*3600000).toISOString().slice(0,10)<=today))tasks.push({id:'meeting:'+m.id,branchId:b.id,kind:'meetings',employeeId:m.sharedAt?m.employeeId:'',assigneeId:m.assigneeId});
   for(const a of actions.filter(a=>a.status==='open'&&a.due<=today)){const m=meetings.find(m=>m.id===a.meetingId);if(m&&m.status!=='closed')tasks.push({id:'promise:'+a.id,branchId:b.id,kind:'meetings',employeeId:m.sharedAt?a.employeeId:'',assigneeId:m.assigneeId})}
   for(const i of items.filter(i=>i.dueAt&&i.dueAt<=today&&i.issued-i.returned-i.lost>0))tasks.push({id:'return:'+i.id,branchId:b.id,kind:'items',employeeId:i.employeeId});
  }
  const claims:{uid:string;kind:Due['kind']}[]=[],day=new Date(now+9*3600000).toISOString().slice(0,10);
  for(const task of tasks){const c={...await contextFromRow(tx,owner,row,task.branchId),now:new Date(now).toISOString()},active=activePeople(c),eligible=new Set(active.filter(e=>e.id===task.employeeId||task.assigneeId===e.id&&currentAssignee(c,e.id,'meetings')).map(e=>e.id));
   const uids=[owner,...(raw._coowners||[]).map((o:any)=>o.userId),...(raw._members||[]).filter((m:any)=>eligible.has(m.employeeId)).map((m:any)=>m.userId)];
   for(const uid of new Set<string>(uids)){const inserted=await tx.prepare('INSERT INTO hr_reminders(owner,id,recipient,day,sent_at) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING').bind(owner,task.id,uid,day,new Date(now).toISOString()).run();if(inserted.meta.changes)claims.push({uid,kind:task.kind})}
  }
  await tx.prepare('DELETE FROM hr_reminders WHERE owner=? AND day<?').bind(owner,new Date(now-90*86400000).toISOString().slice(0,10)).run();return claims;
 });for(const p of pending){await notify(p.uid,{title:'오늘 확인할 사람·교육 업무가 있어요',body:'로그인한 뒤 담당 범위와 기한을 확인해 주세요.',url:'/hr?view='+p.kind});sent++}}
 return{purged,sent};
}
