import {seed} from '../lib/model.ts';
import assert from 'node:assert/strict';import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
const t=await authedTest({env:{HQ_ADMIN_EMAIL:'hq@example.invalid'}}),{q,headersFor,id}=t,env=t.env;let count=0;function ok(name,a,b){assert.deepEqual(a,b,name);console.log(++count+'. PASS '+name)}
async function call(user,path,body,options={}){const r=await api(new Request('https://test.local'+path,{method:options.method||(body?'POST':'GET'),headers:{origin:options.origin||'https://test.local',...(await headersFor(user)),...(options.headers||{})},...(body?{body:JSON.stringify(body)}:{})}),options.env||env);return {status:r.status,data:await r.json()}}
ok('anonymous admin denied',(await call('','/api/admin')).status,403);
ok('forged identity headers cannot open admin',(await call('','/api/admin',null,{headers:{'oai-authenticated-user-id':'hq','oai-authenticated-user-email':'hq@example.invalid'}})).status,403);
ok('customer admin denied',(await call('customer','/api/admin')).status,403);
ok('unconfigured admin denied',(await call('hq','/api/admin',null,{env:{...env,HQ_ADMIN_EMAIL:undefined}})).status,403);
await call('customer','/api/account',{action:'onboard',storeName:'고객 가게',branchName:'본점',ownerName:'가상대표',plan:'basic',acknowledged:true,dpaAgreed:true});
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

await q('INSERT INTO stores VALUES(?,?,?,?)',id('legacy'),JSON.stringify(seed()),1,new Date().toISOString()).run();
const fixture=(await call('legacy','/api/store')).data.state;
const employee=(i)=>({...structuredClone(fixture.employees[0]),id:'capacity-'+i,name:'가상'+i,email:'capacity'+i+'@example.invalid',phone:'01000000000',branchId:'branch-main',status:'재직',contract:{...fixture.employees[0].contract,employer:'가상',workplace:'본점'}});
customer=await call('customer','/api/store');customer.data.state.employees=[0,1,2].map(employee);
let saved=await call('customer','/api/store',{state:customer.data.state,version:customer.data.version},{method:'PUT'});ok('three employees save',saved.status,200);
let fourth=await call('customer','/api/store',{state:{...saved.data.state,employees:[...saved.data.state.employees,employee(3)]},version:saved.data.version},{method:'PUT'});
ok('no employee limit (fourth employee saves)',fourth.status,200);
// 지점 수는 고른 요금(지점 1곳)을 넘으면 저장하지 않는다
const extra=await call('customer','/api/store',{state:{...fourth.data.state,branches:[...fourth.data.state.branches,{id:'b2',name:'2호점',address:''}]},version:fourth.data.version},{method:'PUT'});
ok('branch over chosen count gets capacity code',extra.data.code,'CAPACITY_EXCEEDED');
ok('over branch count never persists',(await call('customer','/api/store')).data.state.branches.length,1);
ok('checkout cannot fake payment',(await call('customer','/api/account',{action:'checkout'})).data.code,'BILLING_NOT_READY');
// 작업 012·073: 사업자 확인 수동 처리, 본사 열람 기록
list=await call('hq','/api/admin');item=list.data.stores[0];ok('biz default 확인 전',item.biz.status,'확인 전');
ok('biz check needs reason',(await call('hq','/api/admin',{action:'bizCheck',id:item.id,version:item.version,status:'수동 확인',reason:''})).status,400);
ok('customer cannot biz check',(await call('customer','/api/admin',{action:'bizCheck',id:item.id,version:item.version,status:'수동 확인',reason:'x'})).status,403);
ok('biz check saves',(await call('hq','/api/admin',{action:'bizCheck',id:item.id,version:item.version,status:'수동 확인',reason:'사업자등록증 사본 확인'})).status,200);
ok('biz filter',(await call('hq','/api/admin?biz='+encodeURIComponent('수동 확인'))).data.matched,1);
ok('biz filter excludes',(await call('hq','/api/admin?biz='+encodeURIComponent('불일치'))).data.matched,0);
list=await call('hq','/api/admin');ok('support memo kept after biz check',list.data.stores[0].support.note,'본사 전용');
const log=(await call('hq','/api/admin?log=1')).data.log;ok('views and actions logged',['가게 목록 열람','사업자 확인 처리','가게 상세 메모 저장'].every(a=>log.some(l=>l.action===a)),true);
ok('log records filters',log.some(l=>l.detail?.filters?.biz==='수동 확인'),true);
ok('customer cannot read HQ log',(await call('customer','/api/admin?log=1')).status,403);
// 작업 066: 가격·약관 변경 고지
const soon=new Date(Date.now()+10*86400000).toISOString().slice(0,10),later=new Date(Date.now()+40*86400000).toISOString().slice(0,10);
ok('notice under 30 days refused',(await call('hq','/api/admin',{action:'serviceNotice',kind:'가격',title:'인상',body:'베이직 인상',effectiveAt:soon})).status,400);
ok('customer cannot post notice',(await call('customer','/api/admin',{action:'serviceNotice',kind:'가격',title:'인상',body:'x',effectiveAt:later})).status,403);
const posted=await call('hq','/api/admin',{action:'serviceNotice',kind:'가격',title:'요금 조정',body:'베이직 1지점 월 요금 변경',effectiveAt:later});ok('notice posted',posted.status,200);
let acct=(await call('customer','/api/account')).data;ok('owner sees unagreed notice',acct.serviceNotices.map(n=>[n.title,n.agreedAt]),[['요금 조정',null]]);
ok('owner agrees',(await call('customer','/api/account',{action:'agreeNotice',id:posted.data.id})).status,200);
acct=(await call('customer','/api/account')).data;ok('agreement recorded',!!acct.serviceNotices[0].agreedAt,true);
ok('HQ sees agreed count',(await call('hq','/api/admin?notices=1')).data.notices[0].agreed,1);
console.log('HQ/capacity checks: '+count+' passed');
await closeAll();
