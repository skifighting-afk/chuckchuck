// 이메일 가입·로그인 점검. 비밀번호와 세션은 Supabase Auth(여기서는 가짜 GoTrue)가 맡고,
// 앱은 Bearer 토큰을 확인해 app_users의 이름·역할·이메일 확인 여부만 쓴다.
import assert from 'node:assert/strict';
import {api} from '../dist/server/index.js';
import {authedTest} from './test-auth.mjs';import {closeAll} from './test-db.mjs';
const {q,sql,env:base,auth}=await authedTest();const env={...base,HQ_ADMIN_EMAIL:'hq@example.invalid'};
const password='Tea42Day';let n=0;
function test(name,truth){assert.ok(truth,name);console.log(`PASS ${++n}. ${name}`)}
async function call(path,body,token='',headers={},method){const r=await api(new Request('https://qa.local'+path,{method:method||(body?'POST':'GET'),headers:{origin:'https://qa.local',...(token?{authorization:'Bearer '+token}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,data:await r.json(),headers:r.headers}}
const tokenOf=r=>r.data?.session?.access_token;
/** 앱 DB 전체에서 문자열 찾기(비밀번호·토큰이 앱 테이블에 남지 않는지 확인) */
async function appDbContains(text){for(const t of ['stores','app_users','auth_limits','auth_verifications','contract_envelopes','payslip_documents']){const rows=await sql.unsafe(`SELECT * FROM ${t}`);if(JSON.stringify(rows).includes(text))return true}return false}
let r=await call('/api/store');test('anonymous cannot see store',r.status===401);
r=await call('/api/auth',{action:'register',agree:true,email:'weak@example.invalid',password:'1234',name:'검수 직원',role:'employee'});test('short password rejected',r.status===400);
r=await call('/api/auth',{action:'register',agree:true,email:'weak@example.invalid',password:'12345678',name:'검수 직원',role:'employee'});test('common sequential password rejected',r.status===400);
r=await call('/api/auth',{action:'register',agree:true,email:'weak@example.invalid',password:'aaaaaaaa',name:'검수 직원',role:'employee'});test('repeated password rejected',r.status===400);
test('rejected passwords never reach Supabase Auth',!auth.calls.some(c=>c.path==='/admin/users'));
r=await call('/api/auth',{action:'register',agree:true,email:'staff@example.invalid',password,name:'검수 직원',role:'employee'});const staffToken=tokenOf(r);test('employee email registration with 8 characters and no symbols succeeds',r.status===200&&!!staffToken);
// 예전: 앱 DB에 솔트+해시 저장 / HttpOnly 쿠키 / 세션 해시 저장. 지금: 자격 증명은 Supabase Auth에만 있고 세션은 Bearer 토큰.
const user=await q('SELECT * FROM app_users WHERE email=?','staff@example.invalid').first();
test('app database stores no password or password hash',!('password_hash' in user)&&!('salt' in user)&&!await appDbContains(password));
test('session is a bearer token, not a cookie',!r.headers.get('set-cookie')&&r.headers.get('cache-control')==='no-store'&&!!r.data.session.refresh_token&&r.data.session.expires_at>Date.now()/1000);
test('session token not stored in app database',!await appDbContains(staffToken));
test('account created through service role with metadata',auth.calls.some(c=>c.path==='/admin/users'&&c.body.user_metadata?.role==='employee'&&c.body.email==='staff@example.invalid'));
r=await call('/api/account',null,staffToken);test('native session resolves employee role',r.data.user?.role==='employee'&&r.data.user?.authMethod==='email');
test('unverified email is honest',r.data.user.emailVerified===false);
r=await call('/api/account',{action:'onboard',plan:'free',storeName:'x',branchName:'x',ownerName:'x',acknowledged:true,dpaAgreed:true},staffToken);test('employee cannot accidentally create owner store',r.status===403);
r=await call('/api/auth',{action:'register',agree:true,email:'STAFF@example.invalid',password,name:'검수',role:'employee'});test('case insensitive duplicate rejected',r.status===409);
r=await call('/api/auth',{action:'login',email:'staff@example.invalid',password:'wrong password'});test('wrong password denied',r.status===401);
r=await call('/api/auth',{action:'login',email:'unknown@example.invalid',password:'wrong password'});test('unknown and wrong login share response',r.status===401&&r.data.error==='이메일 또는 비밀번호를 확인해 주세요.');
r=await call('/api/auth',{action:'login',email:'staff@example.invalid',password});let current=tokenOf(r);test('correct password creates new session',r.status===200&&!!current&&current!==staffToken&&r.data.role==='employee');
r=await call('/api/account',null,'forged-token',{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'hq@example.invalid'});test('bad token cannot fall through to forged identity headers',r.status===401);
r=await call('/api/account',null,env.SUPABASE_ANON_KEY);test('public anon key is not a login',r.status===401);
r=await call('/api/auth',{action:'logout'},current);test('logout succeeds',r.status===200&&r.data.session===null);
r=await call('/api/account',null,current);test('logged out session is revoked',r.status===401);
r=await call('/api/auth',{action:'register',agree:true,email:'hq@example.invalid',password,name:'검수',role:'owner'});const sameHq=tokenOf(r);
r=await call('/api/admin',null,sameHq);test('unverified HQ email never grants admin',r.status===403);
r=await call('/api/auth',{action:'register',agree:true,email:'owner@example.invalid',password,name:'검수 대표',role:'owner'});const ownerToken=tokenOf(r);
// 작업 016·017: 가입·재동의·처리위탁 동의 기록
r=await call('/api/auth',{action:'register',email:'noagree@example.invalid',password,name:'검수',role:'owner'});test('registration without consent rejected',r.status===400&&r.data.code==='CONSENT_REQUIRED');
let consent=(await sql`SELECT terms_version,privacy_version,consented_at FROM app_users WHERE email='owner@example.invalid'`)[0];test('registration stores consent versions and time',!!consent.terms_version&&!!consent.privacy_version&&!!consent.consented_at);
r=await call('/api/account',null,ownerToken);test('current consent not asked again',r.status===200&&r.data.consentRequired===false);
await sql`UPDATE app_users SET terms_version='old' WHERE email='owner@example.invalid'`;
r=await call('/api/account',null,ownerToken);test('changed terms version asks consent again',r.data.consentRequired===true);
r=await call('/api/auth',{action:'consent'},ownerToken);test('re-consent requires explicit agree',r.status===400);
r=await call('/api/auth',{action:'consent',agree:true});test('re-consent requires login',r.status===401);
r=await call('/api/auth',{action:'consent',agree:true},ownerToken);test('re-consent recorded',r.status===200&&(await call('/api/account',null,ownerToken)).data.consentRequired===false);
r=await call('/api/account',{action:'onboard',plan:'starter',storeName:'가상 가입 검수',branchName:'본점',ownerName:'검수 대표',acknowledged:true},ownerToken);test('store creation requires processing agreement',r.status===400&&r.data.code==='DPA_REQUIRED');
r=await call('/api/account',{action:'onboard',plan:'starter',storeName:'가상 가입 검수',branchName:'본점',ownerName:'검수 대표',acknowledged:true,dpaAgreed:true},ownerToken);test('native owner creates their own store',r.status===201);
const dpa=JSON.parse((await sql`SELECT data FROM stores LIMIT 1`)[0].data)._account.dpa;test('processing agreement version and time stored with store',!!dpa?.version&&!!dpa?.agreedAt&&dpa.by.startsWith('native:'));
let state=(await call('/api/store',null,ownerToken)).data;
await call('/api/staff-join',{action:'code',branchId:'branch-main',version:state.version},ownerToken);
let data=(await call('/api/staff-join',null,ownerToken)).data,code=data.codes[0].code;
const fields={employer:'검수 대표',workplace:'가상 본점',duties:'홀 업무',workDays:'월~금',start:'09:00',end:'18:00',breakMinutes:60,weeklyHours:40,wage:12000,payType:'시급',employment:'단시간',payDay:10,holiday:'일요일',leave:'사업장 기준 확인',additional:'검수용 조건'};
r=await call('/api/staff-join',{action:'terms',branchId:'branch-main',fields,version:data.version},ownerToken);test('owner publishes join conditions',r.status===200);
data=(await call('/api/staff-join',null,ownerToken)).data;
r=await call('/api/staff-join',{action:'terms',branchId:'branch-main',fields:{...fields,breakMinutes:600},version:data.version},ownerToken);test('rest exceeding shift rejected',r.status===400);
r=await call('/api/staff-join',{action:'terms',branchId:'branch-main',fields:{...fields,employment:'기간제',endDate:''},version:data.version},ownerToken);test('fixed term requires end date',r.status===400);
r=await call('/api/staff-join',{action:'terms',branchId:'branch-main',fields:{...fields,endDate:'2026-02-31'},version:data.version},ownerToken);test('impossible contract date rejected',r.status===400);
state=(await call('/api/store',null,ownerToken)).data;r=await call('/api/store',state,ownerToken,{},'PUT');test('normal owner save preserves contract setup',r.status===200);
// Fresh login; previous token was revoked.
current=tokenOf(await call('/api/auth',{action:'login',email:'staff@example.invalid',password}));
r=await call('/api/staff-join',{action:'terms',branchId:'branch-main',fields},current);test('employee cannot alter employer conditions',r.status===403);
const profile={address:'가상 검수 주소',joined:'2026-09-24',note:'검수용 신청'};
r=await call('/api/staff-join',{action:'preview',code,name:'검수 직원',phone:'01000000000',profile:{...profile,joined:'2026-02-31'}},current);test('impossible employee start date rejected',r.status===400);
r=await call('/api/staff-join',{action:'preview',code,name:'검수 직원',phone:'01000000000',profile},current);test('employee sees employer contract draft with own details',r.status===200&&r.data.contractText.includes('검수 직원')&&r.data.contractText.includes('가상 검수 주소')&&r.data.contractText.includes('12,000'));
const revision=r.data.terms.revision;
r=await call('/api/staff-join',{action:'apply',code,name:'검수 직원',phone:'01000000000',profile,termsRevision:revision,confirmed:false},current);test('contract review required before apply',r.status===409);
r=await call('/api/staff-join',{action:'apply',code,name:'검수 직원',phone:'01000000000',profile,termsRevision:revision,confirmed:true},current);test('confirmed employee application is submitted',r.status===200);
r=await call('/api/store',null,current);test('pending employee cannot access store',r.status===409);
r=await call('/api/staff-join',null,current);test('pending employee can inspect own submitted draft',r.data.requests[0].status==='pending'&&r.data.requests[0].contractText.includes('12,000'));
data=(await call('/api/staff-join',null,ownerToken)).data;test('owner sees profile and review timestamp',data.requests[0].profile.address==='가상 검수 주소'&&!!data.requests[0].confirmedAt);
r=await call('/api/staff-join',{action:'terms',branchId:'branch-main',fields:{...fields,additional:'변경된 검수용 조건'},version:data.version},ownerToken);test('owner can update future join conditions',r.status===200);
data=(await call('/api/staff-join',null,ownerToken)).data;
r=await call('/api/staff-join',{action:'review',id:data.requests[0].id,approve:true,version:data.version},ownerToken);test('outdated contract acknowledgement cannot be approved',r.status===409);
r=await call('/api/staff-join',{action:'withdraw',id:data.requests[0].id},current);test('employee can recover by withdrawing outdated application',r.status===200);
const revised=(await call('/api/staff-join',{action:'preview',code,name:'검수 직원',phone:'01000000000',profile},current)).data;
r=await call('/api/staff-join',{action:'apply',code,name:'검수 직원',phone:'01000000000',profile,termsRevision:revised.terms.revision,confirmed:true},current);test('employee can confirm revised contract and reapply',r.status===200);
data=(await call('/api/staff-join',null,ownerToken)).data;
r=await call('/api/staff-join',{action:'review',id:data.requests[0].id,approve:true,version:data.version},ownerToken);test('owner approves employee',r.status===200);
r=await call('/api/store',null,current);test('approved employee reaches own screen',r.status===200&&r.data.access==='employee');
const emp=r.data.state.employees.find(e=>e.id===r.data.selfId);test('approved conditions reach wage and contract',emp.wage===12000&&emp.contract.draftText.includes('가상 검수 주소'));
test('contract review does not pretend to be signed',emp.contract.status==='검토 중'&&!emp.contract.signedAt);
// 비밀번호 찾기 메일은 Supabase Auth가 보낸다. Auth 메일 연결이 안 되어 있으면(5xx) 보낸 척하지 않는다.
auth.state.recoverStatus=500;r=await call('/api/auth',{action:'recover',email:'owner@example.invalid'});test('missing email service does not pretend to send',r.status===503&&r.data.code==='EMAIL_NOT_READY');
auth.state.recoverStatus=200;r=await call('/api/auth',{action:'recover',email:'owner@example.invalid'});const rec=auth.calls.filter(c=>c.path==='/recover').at(-1);
test('recovery link returns to this site reset screen',r.status===200&&new URLSearchParams(rec.search).get('redirect_to')==='https://qa.local/login?mode=reset');
r=await call('/api/auth',{action:'recover',email:'nobody@example.invalid'});test('recovery does not reveal unknown accounts',r.status===200);
r=await call('/api/auth',{action:'logout'},ownerToken,{origin:'https://evil.invalid'});test('cross origin authentication mutation rejected',r.status===403);
// 비밀번호 재설정: 메일 링크로 받은 Supabase 토큰(가짜 GoTrue에서는 로그인 토큰으로 대신)으로 새 비밀번호 저장.
const recovery=tokenOf(await call('/api/auth',{action:'login',email:'staff@example.invalid',password}));
r=await call('/api/auth',{action:'reset',token:recovery,password:'New synthetic password 2026!'});test('recovery token changes password',r.status===200);
test('old password no longer works',(await call('/api/auth',{action:'login',email:'staff@example.invalid',password})).status===401);
test('new password works',(await call('/api/auth',{action:'login',email:'staff@example.invalid',password:'New synthetic password 2026!'})).status===200);
r=await call('/api/account',null,current);test('password recovery revokes previous sessions',r.status===401);
test('recovery link proves email ownership',(await q('SELECT email_verified FROM app_users WHERE email=?','staff@example.invalid').first()).email_verified===1);
// 예전 "같은 링크 재사용 불가"는 앱 DB의 일회용 토큰이었다. 지금은 링크 토큰의 수명을 Supabase Auth가 관리하므로, 앱은 무효 토큰을 거절하는지만 확인한다.
r=await call('/api/auth',{action:'reset',token:'x'.repeat(40),password:'Another synthetic password'});test('invalid or expired recovery token rejected',r.status===400);
auth.expire(ownerToken);r=await call('/api/account',null,ownerToken);test('expired sessions denied',r.status===401);
// The limiter must reject before contacting Supabase Auth.
for(let i=0;i<11;i++)r=await call('/api/auth',{action:'register',agree:true,email:'rate@example.invalid',password:'x',name:'검수',role:'employee'});
test('repeated authentication requests limited',r.status===429);
console.log(`${n}/${n} passed`);
await closeAll();
