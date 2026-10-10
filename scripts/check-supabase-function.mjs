// Supabase Edge Function을 Node에서 실제 Postgres와 가짜 Supabase Auth로 돌려 보는 통합 점검.
// 사용: FUNCTION_BUNDLE=<묶은 함수 파일> node scripts/check-supabase-function.mjs
import assert from 'node:assert/strict';
import {testDB,closeAll} from './test-db.mjs';

const APP='https://app.example.kr',SUPA='https://proj.supabase.co';
const {sql}=await testDB();
const schema=(await sql`select current_schema() as s`)[0].s;

// ── 가짜 Supabase Auth ──
const users=new Map(),tokens=new Map();
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const issue=u=>{const t='tok_'+crypto.randomUUID();tokens.set(t,u.id);return {access_token:t,refresh_token:'r_'+t,expires_in:3600,user:u};};
const realFetch=globalThis.fetch;
globalThis.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url);
 if(url.origin!==SUPA)return realFetch(input,init);
 const p=url.pathname.replace('/auth/v1',''),body=init.body?JSON.parse(init.body):{},token=(new Headers(init.headers).get('authorization')||'').slice(7);
 if(p==='/admin/users'){if([...users.values()].some(u=>u.email===body.email))return reply(422,{msg:'exists'});const u={id:crypto.randomUUID(),email:body.email,password:body.password,user_metadata:body.user_metadata};users.set(u.id,u);return reply(200,u);}
 if(p==='/token'&&url.searchParams.get('grant_type')==='password'){const u=[...users.values()].find(u=>u.email===body.email&&u.password===body.password);return u?reply(200,issue(u)):reply(400,{error:'invalid_grant'});}
 if(p==='/user'){const u=users.get(tokens.get(token));if(!u)return reply(401,{msg:'bad jwt'});if(init.method==='PUT'){u.password=body.password}return reply(200,u);}
 if(p==='/logout'){return reply(204,{})}
 if(p==='/recover'){return reply(200,{})}
 return reply(404,{});
};

// ── Deno 흉내 ──
let handler;
globalThis.Deno={env:{get:k=>({SUPABASE_DB_URL:(process.env.TEST_DATABASE_URL||'postgres://postgres:postgres@localhost:5432/chuck_test')+'?options=-c%20search_path%3D'+schema,SUPABASE_URL:SUPA,SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',APP_ORIGIN:APP+',https://skifighting-afk.github.io',HQ_ADMIN_EMAIL:'hq@example.kr'})[k]},serve:h=>{handler=h}};
// 빌드된 함수(npm:postgres를 불러오는 Deno용)를 Node에서 돌리려고 드라이버 경로만 바꾼다.
const {readFileSync,writeFileSync,mkdtempSync}=await import('node:fs');
const bundle=process.env.FUNCTION_BUNDLE||new URL('../supabase/functions/api/index.js',import.meta.url).pathname;
const tmp=mkdtempSync('/tmp/fn-')+'/index.mjs';
writeFileSync(tmp,readFileSync(bundle,'utf8').replace(/(["'])npm:postgres@[^"']+\1/g,JSON.stringify(import.meta.resolve('postgres'))));
await import(tmp);

let session=null;
async function call(path,{method='GET',body,origin=APP,token}={}){
 const headers={apikey:'anon',authorization:'Bearer '+(token??session?.access_token??'anon')};
 if(origin)headers.origin=origin;if(body)headers['content-type']='application/json';
 const r=await handler(new Request(SUPA+'/functions/v1'+path,{method,headers,body:body&&JSON.stringify(body)}));
 return {status:r.status,cors:r.headers.get('access-control-allow-origin'),data:await r.json().catch(()=>null)};
}

let r=await handler(new Request(SUPA+'/functions/v1/api/auth',{method:'OPTIONS',headers:{origin:APP}}));
assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),APP);
r=await call('/api/auth',{method:'POST',body:{action:'login',email:'x@y.kr',password:'whatever1'},origin:'https://evil.example'});
assert.equal(r.status,403,'다른 사이트에서 온 요청은 막아야 함');

r=await call('/api/auth',{method:'POST',body:{action:'register',agree:true,email:'Owner@Example.kr',password:'safe-pass-91',name:'김사장',role:'owner'}});
assert.equal(r.status,200,JSON.stringify(r.data));assert.ok(r.data.session.access_token);session=r.data.session;
r=await call('/api/auth',{method:'POST',body:{action:'register',agree:true,email:'owner@example.kr',password:'safe-pass-91',name:'중복',role:'owner'}});
assert.equal(r.status,409);
r=await call('/api/auth');assert.equal(r.data.authenticated,true);assert.equal(r.data.verified,false);assert.equal(r.data.email,'owner@example.kr');
// 스토어 앱(아이폰 capacitor://localhost, 안드로이드 https://localhost)에서 온 요청: 허용하고, 서버의 같은 출처 검사도 통과해야 함
for(const appOrigin of ['capacitor://localhost','https://localhost']){
 r=await call('/api/auth',{origin:appOrigin});assert.equal(r.cors,appOrigin,'앱 출처 CORS 허용 '+appOrigin);assert.equal(r.data.authenticated,true);
 r=await call('/api/push',{method:'POST',body:{action:'nativeRemove',all:true},origin:appOrigin});assert.equal(r.status,200,'앱에서 보낸 POST가 출처 검사에 막히지 않음 '+appOrigin+' '+JSON.stringify(r.data));
}

// 위조한 신원 헤더는 무시되어야 함
r=await handler(new Request(SUPA+'/functions/v1/api/account',{headers:{origin:APP,apikey:'anon',authorization:'Bearer anon','oai-authenticated-user-id':'native:hacker','oai-authenticated-user-email':'hq@example.kr'}}));
assert.equal(r.status,401,'토큰 없이 신원 헤더만으로는 로그인되면 안 됨');

r=await call('/api/account',{method:'POST',body:{action:'onboard',plan:'pro',storeName:'척척식당',branchName:'본점',ownerName:'김사장',acknowledged:true,dpaAgreed:true}});
assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.storeName,'척척식당');
r=await call('/api/account');assert.equal(r.data.onboarded,true);assert.equal(r.data.user.emailVerified,false);
r=await call('/api/store');assert.equal(r.status,200,JSON.stringify(r.data).slice(0,300));

// 로그아웃 후 다시 로그인
await call('/api/auth',{method:'POST',body:{action:'logout'}});session=null;
r=await call('/api/auth',{method:'POST',body:{action:'login',email:'owner@example.kr',password:'wrong-pass-00'}});assert.equal(r.status,401);
r=await call('/api/auth',{method:'POST',body:{action:'login',email:'owner@example.kr',password:'safe-pass-91'}});assert.equal(r.status,200);assert.equal(r.data.role,'owner');session=r.data.session;

// 비밀번호 재설정: 메일 링크의 토큰으로 새 비밀번호 저장 → 이메일 확인 처리
r=await call('/api/auth',{method:'POST',body:{action:'recover',email:'owner@example.kr'}});assert.equal(r.status,200);
r=await call('/api/auth',{method:'POST',body:{action:'reset',password:'new-pass-777',token:session.access_token}});assert.equal(r.status,200,JSON.stringify(r.data));
r=await call('/api/auth');assert.equal(r.data.verified,true);
r=await call('/api/auth',{method:'POST',body:{action:'login',email:'owner@example.kr',password:'new-pass-777'}});assert.equal(r.status,200);

// 직원 가입
const owner=session;
r=await call('/api/auth',{method:'POST',body:{action:'register',agree:true,email:'staff@example.kr',password:'staff-pass-55',name:'이직원',role:'employee'}});assert.equal(r.status,200);
const staff=r.data.session;
r=await call('/api/account',{token:staff.access_token});assert.equal(r.data.user.role,'employee');
r=await call('/api/account',{method:'POST',token:staff.access_token,body:{action:'onboard',plan:'basic',storeName:'x',branchName:'y',ownerName:'z',acknowledged:true,dpaAgreed:true}});assert.equal(r.status,403);
r=await call('/api/admin',{token:owner.access_token});assert.equal(r.status,403,'일반 사장님은 본사 화면 불가');

console.log('PASS: Supabase 함수 — CORS·출처 차단, 가입·로그인·로그아웃, 신원 헤더 위조 차단, 매장 등록, 비밀번호 재설정, 직원 역할, 본사 권한.');
await closeAll();process.exit(0);
