import assert from 'node:assert/strict';
import {build} from 'rolldown';
import {createHrFixture} from './hr-fixture.mjs';
await build({input:'lib/hr/staffing.ts',platform:'node',output:{file:'.superpowers/sdd/2026-10-11-hr-nine-features/staffing-test.mjs',format:'esm'}});
const {staffingSummary}=await import('../.superpowers/sdd/2026-10-11-hr-nine-features/staffing-test.mjs');
const F=await createHrFixture();let n=0;const eq=(a,b,l)=>{assert.deepEqual(a,b,l);console.log('PASS '+(++n)+' '+l)};
const write=(a,action,b)=>F.call(a,'/api/hr/staffing',F.command(action,b));
try{
 const emp=F.employeeId('staff'),base=await F.store();base.branches[0].hours={open:'09:00',close:'06:00'};const shift=(id,date,start,end,breakMinutes=0)=>({id,employeeId:emp,date,start,end,breakMinutes});
 base.shifts=[shift('night','2026-10-02','22:00','06:00',60)];let r=staffingSummary(base,[],'branch-main','2026-10-01','2026-10-31').find(x=>x.employeeId===emp);eq(r.plannedHours,7,'overnight net time is seven hours');eq(r.weekendStarts,0,'Friday night belongs to Friday');eq(r.shiftDays,1,'overnight shift is one start day');eq(r.closingShifts,1,'store closing time is used');eq(r.preferenceGap,null,'missing preference is not zero');
 base.shifts=[shift('a','2026-10-03','09:00','12:00'),shift('b','2026-10-03','15:00','18:00')];r=staffingSummary(base,[],'branch-main','2026-10-01','2026-10-31').find(x=>x.employeeId===emp);eq(r.shiftDays,1,'two shifts on same day count once');eq(r.evidenceShiftIds.length,2,'both source shifts remain visible');
 base.shifts=[shift('boundary','2026-09-30','22:00','06:00')];eq(staffingSummary(base,[],'branch-main','2026-10-01','2026-10-31').find(x=>x.employeeId===emp).plannedHours,0,'September start is not October work');
 base.shifts=[...Array(6)].map((_,i)=>shift('s'+i,'2026-10-0'+(i+1),'09:00','17:00'));const pref={employeeId:emp,period:'month',periodKey:'2026-10',unit:'hours',min:60,max:70};eq(staffingSummary(base,[pref],'branch-main','2026-10-01','2026-10-31').find(x=>x.employeeId===emp).preferenceGap,-12,'48 assigned versus 60 wanted is minus 12');eq(staffingSummary(base,[{...pref,unit:'days',min:4,max:7}],'branch-main','2026-10-01','2026-10-31').find(x=>x.employeeId===emp).preferenceGap,0,'day preference compares days');
 base.shifts=[shift('pre','2026-09-30','09:00','10:00'),shift('first','2026-10-01','09:00','10:00')];r=staffingSummary(base,[],'branch-main','2026-10-01','2026-10-31').find(x=>x.employeeId===emp);eq(r.longestRun,2,'adjacent outside-period day extends consecutive run');eq(r.evidenceShiftIds.includes('pre'),true,'outside boundary evidence is included');
 let out=await write('staff','savePreference',{period:'month',periodKey:'2026-10',unit:'hours',min:0,max:0});eq(out.status,200,'explicit zero desired hours is valid');let p=out.body.record;
 eq((await write('peer','savePreference',{id:p.id,version:p.version,employeeId:emp,period:'month',periodKey:'2026-10',unit:'hours',min:60,max:70})).status,403,'peer cannot modify preference');
 eq((await write('staff','savePreference',{period:'month',periodKey:'2026-02',unit:'days',min:0,max:30})).status,400,'month days respect calendar');
 eq((await write('boss','reviewPreference',{id:p.id,version:p.version,reviewNote:'다음 편성에서 확인'})).status,200,'owner records consideration');
 eq((await F.call('peer','/api/hr/staffing?period=month&key=2026-10')).body.preferences.some(x=>x.employeeId===emp),false,'employee cannot read colleague preference');
 const before=JSON.stringify((await F.store()).shifts);eq((await F.call('boss','/api/hr/staffing?period=month&key=2026-10')).status,200,'owner can review staffing balance');eq(JSON.stringify((await F.store()).shifts),before,'analysis never edits schedule');
 console.log('PASS: HR staffing '+n+' assertions');
}finally{await F.close()}
