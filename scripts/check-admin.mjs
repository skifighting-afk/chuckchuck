import {seed} from '../lib/model.ts';
import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {api} from '../dist/server/index.js';
const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE stores(owner TEXT PRIMARY KEY,data TEXT,version INTEGER,updated_at TEXT)');
const DB={prepare(sql){let a=[];return {bind(...v){a=v;return this},async first(){return db.prepare(sql).get(...a)},async all(){return {results:db.prepare(sql).all(...a)}},async run(){return {meta:{changes:Number(db.prepare(sql).run(...a).changes)}}}}}};
const env={DB,HQ_ADMIN_EMAIL:'hq@example.invalid'};let count=0;function ok(name,a,b){assert.deepEqual(a,b,name);console.log(++count+'. PASS '+name)}
async function call(user,path,body,options={}){const r=await api(new Request('https://test.local'+path,{method:options.method||(body?'POST':'GET'),headers:{origin:options.origin||'https://test.local',...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.invalid'}:{})},...(body?{body:JSON.stringify(body)}:{})}),options.env||env);return {status:r.status,data:await r.json()}}
ok('anonymous admin denied',(await call('','/api/admin')).status,403);
ok('customer admin denied',(await call('customer','/api/admin')).status,403);
ok('unconfigured admin denied',(await call('hq','/api/admin',null,{env:{DB}})).status,403);
await call('customer','/api/account',{action:'onboard',storeName:'고객 가게',branchName:'본점',ownerName:'가상대표',plan:'free',acknowledged:true});
ok('HQ sees summary',(await call('hq','/api/admin')).data.total,1);
ok('customer has no HQ entry',(await call('customer','/api/account')).data.hq,false);
ok('HQ flag server assigned',(await call('hq','/api/account')).data.hq,true);
let list=await call('hq','/api/admin'),item=list.data.stores[0];
ok('summary excludes wage fields',JSON.stringify(item).includes('wage'),false);
ok('cross origin admin write denied',(await call('hq','/api/admin',{action:'support',id:item.id,version:item.version,note:'검수',status:'확인 중'},{origin:'https://evil.invalid'})).status,403);
ok('invalid status denied',(await call('hq','/api/admin',{action:'support',id:item.id,version:item.version,note:'검수',status:'bad'})).status,400);
ok('support memo saves',(await call('hq','/api/admin',{action:'support',id:item.id,version:item.version,note:'본사 전용',status:'확인 중'})).status,200);
ok('stale save denied',(await call('hq','/api/admin',{action:'support',id:item.id,version:item.version,note:'old',status:'미확인'})).status,409);
let customer=await call('customer','/api/store');ok('internal memo absent in customer payload',JSON.stringify(customer).includes('본사 전용'),false);
await call('customer','/api/store',{state:customer.data.state,version:customer.data.version},{method:'PUT'});
ok('customer save preserves HQ memo',(await call('hq','/api/admin')).data.stores[0].support.note,'본사 전용');

db.prepare('INSERT INTO stores VALUES(?,?,?,?)').run('legacy',JSON.stringify(seed()),1,new Date().toISOString());
const fixture=(await call('legacy','/api/store')).data.state;
const employee=(i)=>({...structuredClone(fixture.employees[0]),id:'capacity-'+i,name:'가상'+i,email:'capacity'+i+'@example.invalid',phone:'01000000000',branchId:'branch-main',status:'재직',contract:{...fixture.employees[0].contract,employer:'가상',workplace:'본점'}});
customer=await call('customer','/api/store');customer.data.state.employees=[0,1,2].map(employee);
let saved=await call('customer','/api/store',{state:customer.data.state,version:customer.data.version},{method:'PUT'});ok('free three employees save',saved.status,200);
let fourth=await call('customer','/api/store',{state:{...saved.data.state,employees:[...saved.data.state.employees,employee(3)]},version:saved.data.version},{method:'PUT'});
ok('fourth employee capacity dialog code',fourth.data.code,'CAPACITY_EXCEEDED');
ok('over limit never persists',(await call('customer','/api/store')).data.state.employees.length,3);
ok('checkout cannot fake payment',(await call('customer','/api/account',{action:'checkout'})).data.code,'BILLING_NOT_READY');
console.log('HQ/capacity checks: '+count+' passed');
