// 매장 매뉴얼: 사장님만 작성, 직원은 자기 지점·전체 것만, 사진 검사·정리
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
ok('anonymous blocked',(await call('','/api/manual')).status,401);
ok('employee cannot upload',(await call('amy','/api/manual',{action:'image',mime:'image/png',body:png})).status,403);
ok('fake PNG rejected',(await call('boss','/api/manual',{action:'image',mime:'image/png',body:btoa('not png')})).status,400);
ok('svg rejected',(await call('boss','/api/manual',{action:'image',mime:'image/svg+xml',body:png})).status,400);
const img=(await call('boss','/api/manual',{action:'image',mime:'image/png',body:png})).body.id;ok('image uploaded',typeof img,'string');
let m=(await call('boss','/api/manual')).body;
ok('empty step rejected',(await call('boss','/api/manual',{action:'save',version:m.version,title:'마감',branchId:'all',steps:[{text:''}]})).status,400);
ok('unknown image rejected',(await call('boss','/api/manual',{action:'save',version:m.version,title:'마감',branchId:'all',steps:[{text:'a',imageId:'nope'}]})).status,400);
let r=await call('boss','/api/manual',{action:'save',version:m.version,title:'마감 청소',branchId:'branch-main',steps:[{text:'바닥 쓸기',imageId:img},{text:'기계 끄기'}]});ok('owner saves manual',r.status,200);
const mid=r.body.manuals.find(x=>x.title==='마감 청소').id;
r=await call('boss','/api/manual',{action:'save',version:r.body.version,title:'전체 공지 매뉴얼',branchId:'all',steps:[{text:'인사하기'}]});
ok('employee sees own branch + all',(await call('amy','/api/manual')).body.manuals.map(x=>x.title).filter(t=>!t.endsWith('(예시)')).sort(),['마감 청소','전체 공지 매뉴얼']);
ok('other branch sees only all',(await call('far','/api/manual')).body.manuals.map(x=>x.title).filter(t=>!t.endsWith('(예시)')),['전체 공지 매뉴얼']);
const res=await raw('amy','/api/manual?image='+img);ok('employee loads image',[res.status,res.headers.get('content-type')],[200,'image/png']);
ok('other branch cannot load image',(await raw('far','/api/manual?image='+img)).status,404);
let a=(await call('amy','/api/manual')).body;r=await call('amy','/api/manual',{action:'read',id:mid,version:a.version});ok('employee marks read',r.body.manuals.find(x=>x.id===mid).read,true);
ok('employee cannot edit',(await call('amy','/api/manual',{action:'delete',id:mid,version:r.body.version})).status,403);
ok('owner sees read count',(await call('boss','/api/manual')).body.manuals.find(x=>x.id===mid).readCount,1);
// 스토어 저장(PUT)이 매뉴얼을 지우지 않는다
const st=(await call('boss','/api/store')).body;await api(new Request('https://qa.local/api/store',{method:'PUT',headers:{origin:'https://qa.local',...(await headersFor('boss'))},body:JSON.stringify({state:st.state,version:st.version})}),env);
ok('store save keeps manuals',(await call('boss','/api/manual')).body.manuals.length,4);
m=(await call('boss','/api/manual')).body;r=await call('boss','/api/manual',{action:'delete',id:mid,version:m.version});ok('owner deletes',r.body.manuals.length,3);
ok('unused image removed',Number((await q('SELECT count(*) AS n FROM store_manual_images WHERE owner=?',id('boss')).first()).n),0);
console.log('PASS: 매장 매뉴얼(작성 권한·지점 범위·사진 검사·확인 표시·정리).');
await closeAll();
