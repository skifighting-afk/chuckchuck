import assert from 'node:assert/strict';
const display=await import('../lib/schedule-display.ts').catch(()=>({}));
assert.equal(typeof display.dailyRange,'function','daily visible range exists');
const {dailyRange,barGeometry,shiftChangeRows}=display;
assert.deepEqual(dailyRange([],undefined),{from:480,to:1320});
assert.deepEqual(dailyRange([],{open:'09:30',close:'21:15'}),{from:480,to:1380});
assert.deepEqual(dailyRange([{start:420,end:1440}],{open:'09:00',close:'21:00'}),{from:360,to:1440});
assert.deepEqual(dailyRange([{start:0,end:360}],{open:'22:00',close:'06:00'}),{from:0,to:1440});
assert.deepEqual(dailyRange([{start:540,end:900}],undefined,true),{from:0,to:1440});
const geometry=barGeometry({start:540,end:900},{from:480,to:1320});assert(Math.abs(geometry.left-100/14)<1e-10);assert(Math.abs(geometry.width-300/7)<1e-10);
const before={employeeId:'a',date:'2026-10-12',start:'09:00',end:'15:00',breakMinutes:60};
assert.deepEqual(shiftChangeRows(before,before),[]);
assert.deepEqual(shiftChangeRows(before,{...before,employeeId:'b',date:'2026-10-13',start:'09:15',end:'16:00',breakMinutes:30}),[
 {key:'employeeId',label:'직원',before:'a',after:'b'},
 {key:'date',label:'근무일',before:'2026-10-12',after:'2026-10-13'},
 {key:'start',label:'출근',before:'09:00',after:'09:15'},
 {key:'end',label:'퇴근',before:'15:00',after:'16:00'},
 {key:'breakMinutes',label:'휴게',before:'60분',after:'30분'}
]);
assert.deepEqual(shiftChangeRows(undefined,before),[]);
console.log('PASS: schedule range contains shifts, correct bar scale and explicit before/after.');
const fixes=await import('../lib/schedule-display.ts');
assert.equal(typeof fixes.shiftChangeGroups,'function','preview diffs the actual series result');
const {seriesEdit}=await import('../lib/schedule-bulk.ts');
const original={...before,id:'s1',series:'repeat',branchId:'one'};
const later={...original,id:'s2',date:'2026-10-19',start:'10:00',end:'16:00'};
const older={...original,id:'s0',date:'2026-10-05'};
const records=[older,original,later];
const projected=seriesEdit(records,'s1',{start:original.start,end:original.end,breakMinutes:original.breakMinutes,position:undefined,note:undefined}).shifts;
const changes=fixes.shiftChangeGroups(records,projected);
assert.equal(changes.length,1,'checking series alone reveals future overwrite');
assert.equal(changes[0].before.id,'s2');assert.deepEqual(changes[0].rows.map(x=>x.key),['start','end']);
const changed=seriesEdit(records,'s1',{start:'09:15',end:'15:00',breakMinutes:30}).shifts;
assert.equal(fixes.shiftChangeGroups(records,changed).length,2);
assert(!fixes.shiftChangeGroups(records,changed).flatMap(x=>x.rows).some(x=>['employeeId','date','branchId'].includes(x.key)),'series never promises discarded identity changes');
assert.equal(typeof fixes.leaveNamesForDay,'function','leave identity remains available');
assert.deepEqual(fixes.leaveNamesForDay([{employeeId:'a',start:'2026-10-12',end:'2026-10-13'},{employeeId:'b',start:'2026-10-13',end:'2026-10-13'}],[{id:'a',name:'민지'},{id:'b',name:'서연'}],'2026-10-12'),['민지']);
