import assert from 'node:assert/strict';
import {parseHistory} from '../lib/history-import.ts';
import {readCsv,sheetRows} from '../lib/xlsx-read.ts';

const employees=[
 {id:'first',name:'김 민지',branchId:'main',branchName:'본점'},
 {id:'second',name:'김민지',branchId:'east',branchName:'동쪽점'},
 {id:'third',name:'이서연',branchId:'main',branchName:'본점'},
];
const header=['이름','날짜','시작','끝'];
const row=['김민지','2026-10-14','17:00','22:00'];
let checks=0,failures=0;
function test(name,run){checks++;try{run();console.log(`${checks}. PASS ${name}`)}catch(error){failures++;console.error(`${checks}. FAIL ${name}: ${error.message}`)}}

test('ambiguous normalized names never select the last employee',()=>{
 const r=parseHistory([header,row],employees);
 assert.equal(r.items.length,0);
 assert.equal(r.problems.length,1);
 assert.deepEqual((r.unmatched??[]).map(x=>[x.line,x.candidates]),[[2,['first','second']]]);
});
test('an explicit in-scope employee selection resolves only the chosen row',()=>{
 const r=parseHistory([header,row,row],employees,{2:'first'});
 assert.equal(r.items.length,1);
 assert.equal(r.items[0].employeeId,'first');
 assert.deepEqual((r.unmatched??[]).map(x=>x.line),[3]);
});
test('a stale or foreign manual selection cannot fall back to a name',()=>{
 const r=parseHistory([header,['이서연',...row.slice(1)]],employees,{2:'foreign'});
 assert.equal(r.items.length,0);
 assert.equal((r.unmatched??[]).length,1);
});
test('a stable employee ID preserves a match after the employee name changes',()=>{
 const r=parseHistory([['직원ID','이름','날짜','시작','끝'],['first','예전이름',...row.slice(1)]],employees);
 assert.equal(r.items[0]?.employeeId,'first');
 assert.equal(r.problems.length,0);
});
test('an unknown file employee ID never silently falls back to a matching name',()=>{
 const r=parseHistory([['직원ID','이름','날짜','시작','끝'],['foreign','이서연',...row.slice(1)]],employees);
 assert.equal(r.items.length,0);
 assert.equal((r.unmatched??[]).length,1);
});
test('a branch column disambiguates equal names without merging people',()=>{
 const r=parseHistory([['이름','매장','날짜','시작','끝'],['김민지','본점',...row.slice(1)],['김민지','동쪽점',...row.slice(1)]],employees);
 assert.deepEqual(r.items.map(x=>x.employeeId),['first','second']);
});
test('an explicit ID that conflicts with the file branch needs review',()=>{
 const r=parseHistory([['직원ID','매장','날짜','시작','끝'],['first','동쪽점',...row.slice(1)]],employees);
 assert.equal(r.items.length,0);
 assert.equal((r.unmatched??[]).length,1);
});
test('ID-only files can identify the correct employee',()=>{
 const r=parseHistory([['사번','날짜','출근','퇴근'],['third','2026-10-14','17:00','22:00']],employees);
 assert.equal(r.kind,'출퇴근');
 assert.equal(r.items[0]?.employeeId,'third');
});
test('payroll import uses the same matching guard as schedule import',()=>{
 const r=parseHistory([['이름','급여월','총지급'],['김민지','2026-10','100000']],employees);
 assert.equal(r.items.length,0);
 assert.equal((r.unmatched??[]).length,1);
});
test('unique-name legacy files retain their existing import result',()=>{
 const r=parseHistory([header,['이서연',...row.slice(1)]],employees);
 assert.deepEqual(r.items,[{employeeId:'third',date:'2026-10-14',start:'17:00',end:'22:00',breakMinutes:0}]);
 assert.equal(r.problems.length,0);
});
test('a row is excluded only after an explicit exclusion choice',()=>{
 const r=parseHistory([header,['이서연',...row.slice(1)]],employees,{2:null});
 assert.equal(r.items.length,0);
 assert.deepEqual(r.excluded,[2]);
});
test('duplicate employee IDs are not silently resolved',()=>{
 const r=parseHistory([['직원ID','날짜','시작','끝'],['first',...row.slice(1)]],[employees[0],{...employees[1],id:'first'}]);
 assert.equal(r.items.length,0);
 assert.equal((r.unmatched??[]).length,1);
});
test('a nonempty record without identity stays unresolved until mapped or excluded',()=>{
 const rows=[header,['이서연',...row.slice(1)],['',...row.slice(1)]];
 assert.equal(parseHistory(rows,employees).unmatched.length,1);
 assert.equal(parseHistory(rows,employees,{3:'first'}).items.length,2);
 assert.deepEqual(parseHistory(rows,employees,{3:null}).excluded,[3]);
});
test('original values remain available to distinguish equal-name records',()=>{
 const r=parseHistory([header,row],employees);
 assert.deepEqual(r.unmatched[0].cells,header.map((title,i)=>({title,value:row[i]})));
});
test('legacy descriptive name headers still match without confusing employee ID',()=>{
 for(const title of ['직원 이름','직원 성명','근로자 이름','근로자 성명']){
  assert.equal(parseHistory([[title,...header.slice(1)],['이서연',...row.slice(1)]],employees).items[0]?.employeeId,'third',title);
 }
 assert.equal(parseHistory([['직원 ID',...header.slice(1)],['third',...row.slice(1)]],employees).items[0]?.employeeId,'third');
});
test('CSV references preserve physical lines across blanks and quoted newlines',()=>{
 const rows=readCsv('이름,날짜,시작,끝\n\n김민지,2026-10-14,17:00,22:00\n"김\n민지",2026-10-15,17:00,22:00\n김민지,2026-10-16,17:00,22:00');
 const r=parseHistory(rows,employees);
 assert.deepEqual(r.unmatched.map(x=>x.line),[3,4,6]);
 assert.equal(parseHistory(rows,employees,{6:'second'}).items[0]?.date,'2026-10-16');
});
test('XLSX references preserve source worksheet row numbers',()=>{
 const xml='<worksheet><sheetData><row r="1">'+header.map((x,i)=>`<c r="${String.fromCharCode(65+i)}1" t="inlineStr"><is><t>${x}</t></is></c>`).join('')+'</row><row r="8">'+row.map((x,i)=>`<c r="${String.fromCharCode(65+i)}8" t="inlineStr"><is><t>${x}</t></is></c>`).join('')+'</row></sheetData></worksheet>';
 const rows=sheetRows(xml);
 assert.equal(parseHistory(rows,employees).unmatched[0].line,8);
 assert.equal(parseHistory(rows,employees,{8:'first'}).items[0]?.employeeId,'first');
});
console.log(`${failures?'FAIL':'PASS'}: ${checks-failures}/${checks} history matching regression cases.`);
process.exitCode=failures?1:0;
