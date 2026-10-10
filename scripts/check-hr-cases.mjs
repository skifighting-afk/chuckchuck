import assert from 'node:assert/strict';import {createHrFixture} from './hr-fixture.mjs';
const F=await createHrFixture();let n=0;const eq=(a,b,l)=>{assert.deepEqual(a,b,l);console.log('PASS '+(++n)+' '+l)},w=(actor,action,b)=>F.call(actor,'/api/hr/cases',F.command(action,b));
try{
 const employeeId=F.employeeId('staff'),assigneeId=F.employeeId('manager'),secret='PRIVATE-CASE-SYNTHETIC';await F.call('boss','/api/hr/grants',F.command('grant',{employeeId:assigneeId,scope:'cases',validUntil:null}));
 eq((await w('staff','submit',{subject:'근무 중 이야기',body:secret,assigneeId,visibilityConfirmed:false})).status,400,'case requires named visibility confirmation');
 const submit=F.command('submit',{subject:'근무 중 이야기',body:secret,assigneeId,visibilityConfirmed:true});let out=await F.call('staff','/api/hr/cases',submit);eq(out.status,201,'employee submits confidential identified case');let c=out.body.record.record;
 eq((await F.call('staff','/api/hr/cases',submit)).status,200,'case retry is idempotent');eq((await F.call('staff','/api/hr/cases')).body.cases.length,1,'retry creates one case');
 for(const actor of ['peer','foreign','outsider'])eq((await F.call(actor,'/api/hr/cases?id='+c.id)).status,404,actor+' cannot read case');
 eq((await F.call('manager','/api/hr/cases?id='+c.id)).status,200,'assigned receiver can read case');
 out=await w('manager','reply',{id:c.id,version:c.version,body:'확인하고 함께 조정해요'});eq(out.status,200,'designated receiver replies');c=out.body.record.record;eq(c.status,'answered','receiver reply marks answered');
 out=await w('staff','reopen',{id:c.id,version:c.version});eq(out.status,200,'author can reopen');c=out.body.record.record;
 eq((await w('staff','reply',{id:c.id,version:c.version-1,body:'입력 보존 검증'})).status,409,'stale reply is rejected');
 const grant=(await F.call('boss','/api/hr/grants')).body.grants.find(g=>g.employeeId===assigneeId);await F.call('boss','/api/hr/grants',F.command('revoke',{id:grant.id,version:grant.version}));
 eq((await w('manager','reply',{id:c.id,version:c.version,body:'권한 없는 답변'})).status,403,'revoked receiver cannot write');eq((await F.call('boss','/api/hr/cases')).body.cases[0].record.status,'handover','owner sees handover pending');
 await F.call('boss','/api/hr/grants',F.command('grant',{employeeId:F.employeeId('peer'),scope:'cases',validUntil:null}));eq((await F.call('peer','/api/hr/cases?id='+c.id)).status,404,'new receiver does not automatically inherit cases');
 out=await w('boss','reassign',{id:c.id,version:c.version,assigneeId:F.employeeId('peer')});eq(out.status,200,'owner explicitly hands over');eq((await F.call('peer','/api/hr/cases?id='+c.id)).status,200,'new assigned receiver now sees case');
 eq(JSON.stringify(await F.store()).includes(secret),false,'case text is outside general store');eq(JSON.stringify((await F.call('boss','/api/export')).body).includes(secret),false,'general export excludes case');eq(JSON.stringify((await F.q('SELECT * FROM hr_audit').all()).results).includes(secret),false,'audit excludes case text');
 const notices=(await F.q('SELECT title,body,url FROM notifications').all()).results;eq(notices.length>0,true,'case change creates a generic notification');eq(JSON.stringify(notices).includes(secret),false,'notifications never contain confidential body');
 console.log('PASS: HR cases '+n+' assertions');
}finally{await F.close()}
