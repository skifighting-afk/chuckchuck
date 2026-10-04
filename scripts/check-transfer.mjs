// 작업 057: 가게 대표 넘기기(양쪽 확인), 기록·문서·출퇴근이 함께 옮겨지는지
import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest,TEST_PASSWORD} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
const T=await authedTest({domain:'example.invalid'}),{q,headersFor,id}=T,env=T.env;
let n=0;function ok(label,value,expected=true){assert.deepEqual(value,expected,label);console.log(`${++n}. PASS ${label}`)}
async function call(user,path,body){const r=await api(new Request('https://qa.local'+path,{method:body?'POST':'GET',headers:{origin:'https://qa.local',...(await headersFor(user))},...(body?{body:JSON.stringify(body)}:{})}),env);return{status:r.status,body:await r.json()}}
await call('boss','/api/account',{action:'onboard',storeName:'넘길 가게',branchName:'본점',ownerName:'이전대표',plan:'pro',acknowledged:true,dpaAgreed:true});
let v=(await call('boss','/api/store')).body.version;await call('boss','/api/staff-join',{action:'code',branchId:'branch-main',version:v});
const code=(await call('boss','/api/staff-join')).body.codes[0].code;await call('amy','/api/staff-join',{action:'apply',code,name:'에이미',phone:'01000000000'});
let j=(await call('boss','/api/staff-join')).body;await call('boss','/api/staff-join',{action:'review',id:j.requests[0].id,approve:true,payType:'시급',wage:10320,version:j.version});
let d=JSON.parse((await q('SELECT data FROM stores WHERE owner=?',id('boss')).first()).data);const eid=d._members[0].employeeId;
await q("INSERT INTO attendance_records(owner,id,employee_id,start_at,record) VALUES(?,?,?,?,?)",id('boss'),'a1',eid,'2026-10-01T00:00:00.000Z',JSON.stringify({id:'a1',employeeId:eid,start:'2026-10-01T00:00:00.000Z',end:'2026-10-01T04:00:00.000Z',breakMinutes:0,breakStart:null})).run();
await q("INSERT INTO payslip_documents(id,owner_id,employee_id,run_key,revision,document_json,document_hash,created_at) VALUES('p1',?,?,'2026-09:branch-main',1,'{}','h',?)",id('boss'),eid,new Date().toISOString()).run().catch(()=>{});
await q("INSERT INTO contract_envelopes(id,owner_id,employee_id,employee_user_id,document_json,document_hash,owner_signature,status,created_at) VALUES('c1',?,?,?,'{}','h','{}','waiting',?)",id('boss'),eid,id('amy'),new Date().toISOString()).run();
await call('heir','/api/account');await call('other','/api/account',{action:'onboard',storeName:'다른 가게',branchName:'본점',ownerName:'다른',plan:'basic',acknowledged:true,dpaAgreed:true});
const start=b=>call('boss','/api/account',{action:'transferStart',...b});
ok('employee cannot start transfer',(await call('amy','/api/account',{action:'transferStart',email:'heir@example.invalid',confirmName:'넘길 가게',password:TEST_PASSWORD})).status,403);
ok('store name must match',(await start({email:'heir@example.invalid',confirmName:'틀린 이름',password:TEST_PASSWORD})).status,400);
ok('password required',(await start({email:'heir@example.invalid',confirmName:'넘길 가게',password:'wrong'})).status,400);
ok('cannot transfer to self',(await start({email:'boss@example.invalid',confirmName:'넘길 가게',password:TEST_PASSWORD})).status,400);
let r=await start({email:'HEIR@example.invalid',confirmName:'넘길 가게',password:TEST_PASSWORD});ok('transfer requested',r.status,200);ok('owner sees pending',r.body.account.transfer.toEmail,'heir@example.invalid');
ok('heir sees offer',(await call('heir','/api/account')).body.transferOffers.map(o=>o.storeName),['넘길 가게']);
ok('unrelated user sees nothing',(await call('stranger','/api/account')).body.transferOffers,[]);
ok('wrong account cannot accept',(await call('stranger','/api/account',{action:'transferAccept',owner:id('boss'),password:TEST_PASSWORD})).status,404);
ok('owner of another store cannot accept',(await call('other','/api/account',{action:'transferAccept',owner:id('boss'),password:TEST_PASSWORD})).status,409);
ok('heir password checked',(await call('heir','/api/account',{action:'transferAccept',owner:id('boss'),password:'nope'})).status,400);
r=await call('heir','/api/account',{action:'transferAccept',owner:id('boss'),password:TEST_PASSWORD});ok('heir accepts',r.status,200);
const st=await call('heir','/api/store');ok('heir now owns store with staff',[st.status,st.body.access,st.body.state.employees.length],[200,'owner',1]);
ok('shift mirror moved',Number((await q('SELECT count(*) AS n FROM shift_records WHERE owner=?',id('boss')).first()).n)===0&&Number((await q('SELECT shift_mirror_drift(?) AS n',id('heir')).first()).n)===0);
ok('attendance moved',Number((await q('SELECT count(*) AS n FROM attendance_records WHERE owner=?',id('heir')).first()).n),1);
ok('contract moved, body unchanged',(await q("SELECT owner_id,document_json FROM contract_envelopes WHERE id='c1'").first()),{owner_id:id('heir'),document_json:'{}'});
let blocked=false;try{await q("UPDATE contract_envelopes SET owner_id='x' WHERE id='c1'").run()}catch{blocked=true}ok('owner change still blocked outside transfer',blocked);
ok('old owner left store',(await call('boss','/api/store')).status,409);
ok('employee still linked',(await call('amy','/api/store')).status,200);
ok('audit has transfer',st.body.audit.some(a=>a.action==='가게 대표 변경'),true);
ok('offer gone after accept',(await call('heir','/api/account')).body.transferOffers===undefined||(await call('heir','/api/account')).body.transferOffers.length===0);
console.log('PASS: 가게 대표 넘기기.');
await closeAll();
