// 지시서 041: 직원 서류 보관함 — 사장님은 우리 직원 것, 직원은 자기 것만
import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
const T=await authedTest({domain:'example.invalid'}),{q,headersFor,id}=T,env=T.env;
let n=0;function ok(label,value,expected=true){assert.deepEqual(value,expected,label);console.log(`${++n}. PASS ${label}`)}
async function raw(user,path,body){return api(new Request('https://qa.local'+path,{method:body?'POST':'GET',headers:{origin:'https://qa.local',...(await headersFor(user))},...(body?{body:JSON.stringify(body)}:{})}),env)}
async function call(user,path,body){const r=await raw(user,path,body);return{status:r.status,body:await r.json()}}
await call('boss','/api/account',{action:'onboard',storeName:'매뉴얼 검수',branchName:'본점',ownerName:'가상대표',plan:'pro',storeSlots:2,acknowledged:true,dpaAgreed:true});
let v=(await call('boss','/api/store')).body.version;await call('boss','/api/staff-join',{action:'code',branchId:'branch-main',version:v});
const code=(await call('boss','/api/staff-join')).body.codes[0].code;
for(const [user,name]of[['amy','에이미'],['far','다른지점']]){await call(user,'/api/staff-join',{action:'apply',code,name,phone:'01000000000'});const j=(await call('boss','/api/staff-join')).body;await call('boss','/api/staff-join',{action:'review',id:j.requests.find(r=>r.status==='pending').id,approve:true,payType:'시급',wage:10320,version:j.version});}
let d=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('boss')).first()).data);const F=d._members.find(m=>m.userId===id('far')).employeeId;d.branches.push({id:'b2',name:'2호점',address:''});d.employees.find(e=>e.id===F).branchId='b2';await q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(d),id('boss')).run();
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const A=d._members.find(m=>m.userId===id('amy')).employeeId;
ok('anonymous blocked',(await call('','/api/staff-docs')).status,401);
ok('ID card kind refused',(await call('amy','/api/staff-docs',{action:'upload',kind:'신분증',mime:'image/png',body:png})).status,400);
ok('fake PNG refused',(await call('amy','/api/staff-docs',{action:'upload',kind:'보건증',mime:'image/png',body:btoa('x')})).status,400);
const up=await call('amy','/api/staff-docs',{action:'upload',kind:'보건증',mime:'image/png',body:png});ok('staff uploads own',up.status,201);
ok('staff cannot upload for coworker',(await call('amy','/api/staff-docs',{action:'upload',employeeId:F,kind:'보건증',mime:'image/png',body:png})).status,403);
ok('owner sees staff doc',(await call('boss','/api/staff-docs?employee='+A)).body.docs.length,1);
ok('other staff cannot list',(await call('far','/api/staff-docs?employee='+A)).status,403);
ok('other staff cannot open file',(await raw('far','/api/staff-docs?id='+up.body.id)).status,404);
const f=await raw('boss','/api/staff-docs?id='+up.body.id);ok('owner opens image',f.status===200&&f.headers.get('content-type')==='image/png',true);
ok('owner uploads for staff',(await call('boss','/api/staff-docs',{action:'upload',employeeId:A,kind:'통장 사본',mime:'image/png',body:png})).status,201);
const list=(await call('amy','/api/staff-docs')).body.docs;ok('staff lists own',list.length,2);
ok('staff cannot delete owner upload',(await call('amy','/api/staff-docs',{action:'delete',id:list.find(x=>x.kind==='통장 사본').id})).status,403);
ok('staff deletes own upload',(await call('amy','/api/staff-docs',{action:'delete',id:up.body.id})).status,200);
await q('DELETE FROM staff_documents WHERE owner=?',id('boss')).run();
console.log('PASS: 직원 서류 보관함 (본인·사장님만, 사진 검사).');
await closeAll();
