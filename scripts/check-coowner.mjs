// 지시서 108·145: 공동 관리자 초대·수락, 여러 가게 전환
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


ok('staff cannot invite coowner',(await call('amy','/api/account',{action:'coownerInvite'})).status,403);
const inv=await call('boss','/api/account',{action:'coownerInvite'});ok('owner makes invite',inv.status,200);
const token=new URL(inv.body.url).searchParams.get('token');
ok('owner cannot accept own invite',(await call('boss','/api/account',{action:'acceptCoowner',token})).status,400);
ok('staff of same store cannot become coowner',(await call('amy','/api/account',{action:'acceptCoowner',token})).status,409);
await call('cara','/api/account',{action:'onboard',storeName:'카라네',branchName:'본점',ownerName:'카라',plan:'basic',acknowledged:true,dpaAgreed:true});
ok('other owner accepts',(await call('cara','/api/account',{action:'acceptCoowner',token})).status,200);
ok('token single use',(await call('dan','/api/account',{action:'acceptCoowner',token})).status,404);
let acc=(await call('cara','/api/account')).body;ok('cara sees two stores, now on boss store',[acc.stores.length,acc.currentStore===id('boss'),acc.coowner],[2,true,true]);
const st=(await call('cara','/api/store')).body;ok('coowner has owner access',st.access,'owner');
await call('cara','/api/account');const own=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('cara')).first()).data),bossD=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('boss')).first()).data);
ok('viewing coowned store never overwrites own store',[own.store.name,bossD.store.name],['카라네','매뉴얼 검수']);
ok('coowner cannot change plan',(await call('cara','/api/account',{action:'coownerInvite'})).status,403);
ok('switch back to own store',(await call('cara','/api/account',{action:'switchStore',owner:id('cara')})).status,200);
ok('own store now',(await call('cara','/api/store')).body.state.store.name,'카라네');
ok('cannot switch to foreign store',(await call('cara','/api/account',{action:'switchStore',owner:'native:nope'})).status,403);
ok('owner lists coowners',(await call('boss','/api/account')).body.coowners.length,1);
ok('owner removes coowner',(await call('boss','/api/account',{action:'removeCoowner',userId:id('cara')})).status,200);
ok('removed coowner sees only own store',(await call('cara','/api/account')).body.stores.length,1);
console.log('PASS: 공동 관리자·가게 전환.');
await closeAll();
