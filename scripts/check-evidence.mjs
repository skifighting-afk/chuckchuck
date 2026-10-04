import assert from 'node:assert/strict';import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
const {q,env,headersFor,id}=await authedTest();
const data={employees:[{id:'e1',status:'재직',access:'직원'},{id:'e2',status:'재직',access:'중간관리자'}],_members:[{userId:id('staff'),employeeId:'e1'},{userId:id('manager'),employeeId:'e2'}],_operations:{leaves:[{id:'l1',employeeId:'e1',status:'승인 대기'}]}};await q('INSERT INTO stores VALUES(?,?,1,?)',id('owner'),JSON.stringify(data),new Date().toISOString()).run();await q('INSERT INTO stores VALUES(?,?,1,?)',id('other'),JSON.stringify({...data,_members:[]}),new Date().toISOString()).run();
const file={mime:'application/pdf',body:btoa('%PDF-1.4\nSynthetic test only\n%%EOF'),consent:true};
async function call(user,method='GET',body,path='/api/evidence?leave=l1',origin='https://test.local'){const r=await api(new Request('https://test.local'+path,{method,headers:{origin,...(await headersFor(user))},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,data:await r.json()}}
assert.equal((await call('')).status,401);assert.equal((await call('manager')).status,404);assert.equal((await call('staff','POST',{...file,consent:false})).status,400);assert.equal((await call('staff','POST',{...file,body:btoa('<html>') })).status,400);assert.equal((await call('staff','POST',file,undefined,'https://evil.invalid')).status,403);assert.equal((await call('staff','POST',{...file,body:btoa('%PDF-'+ 'a'.repeat(512000))})).status,400);
assert.equal((await call('staff','POST',file)).status,200);let r=await call('owner');assert.equal(r.data.files.length,1);const fileId=r.data.files[0].id;assert.equal((await call('staff','GET',null,'/api/evidence?leave=l1&id='+fileId)).data.body,file.body);assert.equal((await call('other','GET',null,'/api/evidence?leave=l1&id='+fileId)).status,404);assert.equal((await call('manager','DELETE',null,'/api/evidence?leave=l1&id='+fileId)).status,404);assert.equal((await call('staff','POST',file)).status,200);assert.equal((await call('staff','POST',file)).status,200);assert.equal((await call('staff','POST',file)).status,409);await q('UPDATE leave_evidence SET expires_at=? WHERE id=?','2020-01-01',fileId).run();assert.equal((await call('owner','GET',null,'/api/evidence?leave=l1&id='+fileId)).status,404);assert.equal((await call('owner','DELETE',null,'/api/evidence?leave=l1&id='+fileId)).status,200);assert.equal((await q('SELECT count(*) AS n FROM leave_evidence WHERE id=?',fileId).first()).n,0);
// 작업 072: 보관 기간이 지난 증빙은 다른 가게의 업로드가 없어도 매일 정리 작업에서 지워진다.
await q("INSERT INTO leave_evidence (id,owner,leave_id,employee_id,mime,body,bytes,created_at,expires_at) VALUES ('old1','other-store','lx','ex','application/pdf','AA',1,'2026-01-01T00:00:00.000Z','2026-01-31T00:00:00.000Z'),('new1','other-store','lx','ex','application/pdf','AA',1,'2026-10-01T00:00:00.000Z','2999-01-01T00:00:00.000Z')").run();
await q("INSERT INTO auth_limits(bucket,hits,expires_at) VALUES('stale',1,1),('live',1,?)",Date.now()+3600000).run();
const purged=(await q('SELECT purge_expired() AS r').first()).r;
assert.equal(purged.leave_evidence>=1,true);assert.equal(purged.auth_limits>=1,true);
assert.equal((await q("SELECT count(*) AS n FROM leave_evidence WHERE id='old1'").first()).n,0);
assert.equal((await q("SELECT count(*) AS n FROM leave_evidence WHERE id='new1'").first()).n,1);
assert.equal((await q("SELECT count(*) AS n FROM auth_limits WHERE bucket='live'").first()).n,1);
console.log('PASS expired evidence and login-limit rows are purged; unexpired rows stay.');
console.log('PASS evidence auth, owner/self only, tenant isolation, origin, consent, signature, size, quota, expiry and deletion.');
await closeAll();
