// 본사(HQ) 권한: Supabase 계정 + 설정값으로만 열린다.
// HQ_NATIVE_USER_ID와 정확히 같은 계정, 또는 이메일 확인을 마친 HQ_ADMIN_EMAIL 계정만 허용.
import assert from 'node:assert/strict';import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
const {q,env:base}=await authedTest();const env={...base,HQ_ADMIN_EMAIL:'old-hq@example.invalid'};let count=0;const ok=(name,truth)=>{assert.ok(truth,name);console.log(++count+'. PASS '+name)};
async function call(path,body,token='',headers={}){const r=await api(new Request('https://qa.local'+path,{method:body?'POST':'GET',headers:{origin:'https://qa.local',...(token?{authorization:'Bearer '+token}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,data:await r.json()}}
let r=await call('/api/auth',{action:'register',email:'operator@example.invalid',name:'운영 검수',role:'owner',password:'ShopDay92'});const ownerToken=r.data.session?.access_token;ok('registration returns a session for own login',r.status===200&&!!ownerToken);ok('signup alone grants no HQ',(await call('/api/admin',null,ownerToken)).status===403);
const id=(await q('SELECT id FROM app_users WHERE email=?','operator@example.invalid').first()).id;ok('app user id is native Supabase id',id.startsWith('native:'));env.HQ_NATIVE_USER_ID=id;
r=await call('/api/admin',null,ownerToken);ok('exact configured native user can access',r.status===200&&r.data.adminAuthMethod==='email');ok('account menu sees granted HQ',(await call('/api/account',null,ownerToken)).data.hq===true);
r=await call('/api/auth',{action:'register',email:'old-hq@example.invalid',name:'동일 메일 검수',role:'owner',password:'ShopDay93'});const otherToken=r.data.session.access_token;ok('unverified HQ email does not grant admin',(await call('/api/admin',null,otherToken)).status===403);ok('unverified HQ email account remains restricted',(await call('/api/account',null,otherToken)).data.hq===false);
// 예전 플랫폼 신원 헤더는 이제 위조로 취급되어 지워진다.
r=await call('/api/admin',null,otherToken,{'oai-authenticated-user-id':'old-hq','oai-authenticated-user-email':'old-hq@example.invalid','oai-authenticated-user-email-verified':'true'});ok('forged identity headers do not grant admin',r.status===403);
r=await call('/api/admin',null,'',{'oai-authenticated-user-id':id,'oai-authenticated-user-email':'operator@example.invalid'});ok('forged configured user id without token denied',r.status===403);
await q('UPDATE app_users SET email_verified=1 WHERE email=?','old-hq@example.invalid').run();
r=await call('/api/admin',null,otherToken);ok('verified HQ_ADMIN_EMAIL account gains access',r.status===200&&r.data.adminAuthMethod==='email');
const wrong=await call('/api/auth',{action:'login',email:'operator@example.invalid',password:'wrong'});ok('HQ uses real password authentication',wrong.status===401);
await call('/api/auth',{action:'logout'},ownerToken);ok('logout revokes native HQ session',(await call('/api/admin',null,ownerToken)).status===403);
r=await call('/api/auth',{action:'login',email:'operator@example.invalid',password:'ShopDay92'});const again=r.data.session.access_token;ok('reauth restores allowed HQ access',(await call('/api/admin',null,again)).status===200);delete env.HQ_NATIVE_USER_ID;ok('removing config revokes HQ immediately',(await call('/api/admin',null,again)).status===403);
console.log('Native HQ checks: '+count+' passed');
await closeAll();
