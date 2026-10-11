import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';
import {closeAll} from './test-db.mjs';
import {normalizeTeam} from '../dist/server/team-model.js';
const {q,env,headersFor,id}=await authedTest();
const now=new Date(),day=new Date(+now+9*3600000).toISOString().slice(0,10),w=new Date(day+'T00:00:00Z').getUTCDay(),week=new Date(Date.parse(day+'T00:00:00Z')-(w+6)%7*86400000).toISOString().slice(0,10),key='branch-main:'+week;
const state=normalizeTeam();state.attendance=[];state.shifts=[];state.payrollRuns={};
state.employees=state.employees.slice(0,5);const [pending,acked,unlinked,retired,other]=state.employees;
for(const e of state.employees){e.branchId='branch-main';e.status='재직'}retired.status='퇴사';other.branchId='other';state.branches.push({...state.branches[0],id:'other',name:'다른 매장'});
state.publishedWeeks={[key]:{at:now.toISOString(),acks:{[acked.id]:now.toISOString()}}};
const raw={...state,_members:[{employeeId:pending.id,userId:id('pending')},{employeeId:acked.id,userId:id('acked')},{employeeId:retired.id,userId:id('retired')},{employeeId:other.id,userId:id('other')}]};
async function call(user,body){const r=await api(new Request('https://pub.test/api/store',{method:body?'POST':'GET',headers:{origin:'https://pub.test',...await headersFor(user)},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,data:await r.json()}}
try{
 await headersFor('owner');await q('INSERT INTO stores VALUES(?,?,?,?)',id('owner'),JSON.stringify(raw),1,now.toISOString()).run();
 assert.equal((await call('pending',{action:'remindWeek',key,version:1})).status,403,'employee cannot send reminders');
 assert.equal((await call('owner',{action:'remindWeek',key,version:0})).status,409,'stale view cannot remind');
 let r=await call('owner',{action:'remindWeek',key,version:1});assert.equal(r.status,200,JSON.stringify(r.data));
 assert.equal(r.data.state.publishedWeeks[key].acks[acked.id],now.toISOString(),'reminder never resets existing acknowledgment');
 const notifications=(await q('SELECT user_id,title FROM notifications').all()).results.filter(x=>x.title==='근무표 확인을 부탁드려요');assert.deepEqual(notifications.map(n=>n.user_id),[id('pending')]);
 assert.equal((await call('owner',{action:'remindWeek',key,version:r.data.version})).status,400,'repeat inside one hour rejected');
 r=await call('owner');assert.equal((await call('owner',{action:'remindWeek',key:'other:'+week,version:r.data.version})).status,400,'unpublished week cannot remind');
 assert.equal((await call('pending')).data.state.publishedWeeks[key].acks[acked.id],undefined,'personal response still strips colleague acknowledgments');
 console.log('PASS: real reminder API owner permission, optimistic version, exact linked pending recipients, preserved acknowledgments, one-hour guard and personal privacy.');
}finally{await closeAll()}
