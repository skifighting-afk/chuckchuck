import assert from 'node:assert/strict';import {createHrFixture} from './hr-fixture.mjs';
const F=await createHrFixture();let n=0;const eq=(a,b,l)=>{assert.deepEqual(a,b,l);console.log('PASS '+(++n)+' '+l)},w=(actor,action,b)=>F.call(actor,'/api/hr/meetings',F.command(action,b));
try{
 const secret='PRIVATE-MEETING-SYNTHETIC',employeeId=F.employeeId('staff'),assigneeId=F.employeeId('manager'),before=JSON.stringify((await F.store()).employees);
 await F.call('boss','/api/hr/grants',F.command('grant',{employeeId:assigneeId,scope:'meetings',validUntil:null}));
 let out=await w('boss','save',{employeeId,assigneeId,scheduledAt:'2026-11-01T09:00:00.000Z',topic:'첫 달 돌아보기',sharedSummary:'다음 주 함께 연습해요',privateNote:secret,status:'scheduled'});eq(out.status,201,'owner saves meeting');let m=out.body.record.meeting;
 eq((await F.call('staff','/api/hr/meetings')).body.meetings.length,0,'unshared draft is hidden from employee');
 eq((await F.call('manager','/api/hr/meetings')).body.meetings[0].privateNote,secret,'assigned delegated manager sees private note');
 await F.call('boss','/api/hr/grants',F.command('grant',{employeeId:F.employeeId('peer'),scope:'meetings',validUntil:null}));
 eq((await F.call('peer','/api/hr/meetings')).body.meetings.length,0,'unassigned delegated manager cannot read meeting');
 eq((await w('boss','share',{id:m.id,version:m.version,confirmed:false})).status,400,'sharing needs explicit visibility confirmation');
 out=await w('boss','share',{id:m.id,version:m.version,confirmed:true});eq(out.status,200,'explicit share works');m=out.body.record.meeting;
 let view=(await F.call('staff','/api/hr/meetings')).body;eq(view.meetings[0].meeting.sharedSummary,'다음 주 함께 연습해요','employee sees shared summary');eq(JSON.stringify(view).includes(secret),false,'employee DTO never includes private note');
 out=await w('staff','ack',{id:m.id,version:m.version});eq(out.status,200,'employee acknowledges own summary');m=out.body.record.meeting;
 eq((await w('staff','comment',{id:m.id,version:m.version,body:'확인했어요'})).status,200,'employee can leave shared comment');m=(await F.call('boss','/api/hr/meetings')).body.meetings[0].meeting;
 out=await w('boss','action',{meetingId:m.id,version:m.version,text:'포스 연습',employeeId,due:'2026-11-10'});eq(out.status,200,'meeting promise is saved');m=out.body.record.meeting;let a=out.body.record.actions[0];
 out=await w('boss','action',{meetingId:m.id,version:m.version,id:a.id,actionVersion:a.version,text:a.text,employeeId,due:'2026-11-12'});eq(out.status,200,'promise due date can change');m=out.body.record.meeting;a=out.body.record.actions[0];eq(a.history.length,2,'due date history is preserved');
 eq((await w('staff','actionComplete',{meetingId:m.id,version:m.version,id:a.id,actionVersion:a.version})).status,200,'employee completes own promise');
 const grant=(await F.call('boss','/api/hr/grants')).body.grants.find(g=>g.employeeId===assigneeId&&g.scope==='meetings');await F.call('boss','/api/hr/grants',F.command('revoke',{id:grant.id,version:grant.version}));
 eq((await F.call('manager','/api/hr/meetings')).body.meetings.length,0,'revoked assignee loses read access');eq((await F.call('boss','/api/hr/meetings')).body.meetings[0].handover,true,'owner sees pending handover');
 eq(JSON.stringify((await F.store()).employees),before,'meeting does not change pay contract or employee');
 eq(JSON.stringify(await F.store()).includes(secret),false,'private note is absent from general store');eq(JSON.stringify((await F.q('SELECT * FROM hr_audit').all()).results).includes(secret),false,'private note is absent from audit');
 await F.patchStore(d=>{d.employees.find(e=>e.id===assigneeId).status='퇴사';d.employees.find(e=>e.id===assigneeId).endDate='2026-01-01'});eq((await F.call('manager','/api/hr/meetings')).status,403,'departed assignee cannot access HR');
 console.log('PASS: HR meetings '+n+' assertions');
}finally{await F.close()}
