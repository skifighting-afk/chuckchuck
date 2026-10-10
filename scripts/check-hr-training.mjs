import assert from 'node:assert/strict';
import {createHrFixture} from './hr-fixture.mjs';
const F=await createHrFixture();let n=0;const eq=(a,b,l)=>{assert.deepEqual(a,b,l);console.log('PASS '+(++n)+' '+l)};
const call=(actor,action,b={})=>F.call(actor,'/api/hr/training',F.command(action,b));
try{
 const tags=JSON.stringify((await F.store()).employees.map(e=>e.extra?.skills));
 await F.patchStore(d=>{d._manuals=[{id:'visible',title:'기본 교육',branchId:'branch-main',roles:[],steps:[],updatedAt:new Date().toISOString()},{id:'private',title:'관리자 한정',branchId:'branch-main',roles:['점장'],steps:[],updatedAt:new Date().toISOString()}]});
 let r=await call('boss','assignBuddy',{employeeId:F.employeeId('staff'),buddyId:F.employeeId('peer'),from:'2026-01-01',until:'2027-12-31',steps:[{title:'오픈 순서',manualId:'visible'}]});eq(r.status,201,'owner assigns a buddy with learning steps');let a=r.body.record;
 eq((await call('boss','assignBuddy',{employeeId:F.employeeId('staff'),buddyId:F.employeeId('peer'),from:'2026-01-01',until:'2027-12-31',steps:[{title:'비공개 주입',manualId:'private'}]})).status,404,'hidden manual cannot be injected');
 eq((await call('manager','updateStep',{id:a.id,version:a.version,stepId:a.steps[0].id,progress:'doing',note:''})).status,403,'unassigned manager cannot change learning');
 r=await call('peer','updateStep',{id:a.id,version:a.version,stepId:a.steps[0].id,progress:'awaiting_ack',note:'함께 연습함'});eq(r.status,200,'assigned buddy can request learner acknowledgment');a=r.body.record;
 eq((await call('peer','ackStep',{id:a.id,version:a.version,stepId:a.steps[0].id})).status,403,'buddy cannot acknowledge for learner');
 r=await call('staff','ackStep',{id:a.id,version:a.version,stepId:a.steps[0].id});eq(r.status,200,'learner confirms own learning');a=r.body.record;eq(a.steps[0].progress,'done','acknowledgment completes learning');
 r=await call('boss','reassignBuddy',{id:a.id,version:a.version,buddyId:F.employeeId('manager')});eq(r.status,200,'owner reassigns buddy');a=r.body.record;
 eq((await call('peer','updateStep',{id:a.id,version:a.version,stepId:a.steps[0].id,progress:'doing',note:''})).status,403,'former buddy loses write access immediately');
 eq((await F.call('manager','/api/hr/training')).body.buddies[0].id,a.id,'new buddy sees carried learning');
 r=await call('boss','saveSkill',{name:'포스 마감',manualId:'visible'});eq(r.status,201,'owner defines a skill');const skill=r.body.record;
 eq((await call('staff','setLevel',{employeeId:F.employeeId('staff'),skillId:skill.id,level:'혼자 가능',note:''})).status,403,'employee cannot self certify');
 r=await call('boss','setLevel',{employeeId:F.employeeId('staff'),skillId:skill.id,level:'교육 중',note:'연습 필요'});eq(r.status,200,'authorized human confirms skill level');let level=r.body.record;
 r=await call('staff','requestReview',{id:level.id,version:level.version});eq(r.status,200,'employee requests review without changing level');level=r.body.record;eq(level.level,'교육 중','request is not self certification');
 eq((await call('boss','setLevel',{id:level.id,version:level.version-1,employeeId:F.employeeId('staff'),skillId:skill.id,level:'혼자 가능',note:''})).status,409,'concurrent skill edit is rejected');
 await F.call('boss','/api/hr/grants',F.command('grant',{employeeId:F.employeeId('manager'),scope:'training',validUntil:null}));
 eq((await call('manager','setLevel',{employeeId:F.employeeId('manager'),skillId:skill.id,level:'혼자 가능',note:''})).status,403,'delegated reviewer cannot certify self');
 eq(JSON.stringify((await F.store()).employees.map(e=>e.extra?.skills)),tags,'existing free skill tags are preserved');
 await F.patchStore(d=>{d.employees.find(e=>e.id===F.employeeId('manager')).branchId='branch-other'});
 eq((await F.call('manager','/api/hr/training')).body.buddies.length,0,'transferred buddy cannot retain old branch training');
 eq((await F.call('boss','/api/hr/training')).body.buddies[0].handover,true,'owner sees handover requirement');
 console.log('PASS: HR training '+n+' assertions');
}finally{await F.close()}
