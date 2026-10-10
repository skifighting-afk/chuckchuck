// 작업 004: 배포 후 실제 주소에서 가입 → 가게 만들기 → 로그아웃 → 다시 로그인을 확인한다.
// 점검용 계정은 성공·실패와 상관없이 마지막에 지운다(Supabase 관리 API로 SQL 실행).
// 환경 변수: SMOKE_URL(기본 https://chukchukapp.kr), EXPECT_SHA(새 화면 확인용), SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF
// 로컬: SMOKE_URL=http://localhost:8787 SMOKE_SKIP_CLEANUP=1 node scripts/smoke-prod.mjs
import {chromium} from 'playwright';
const BASE=(process.env.SMOKE_URL||'https://chukchukapp.kr').replace(/\/$/,'');
const tag=(process.env.GITHUB_RUN_ID||'local')+'-'+Math.random().toString(36).slice(2,8);
const email=`e2e-${tag}@chukchukapp.kr`,password='Smoke-'+crypto.randomUUID().slice(0,12),store='점검가게 '+tag.slice(-6);
const log=(...a)=>console.log(new Date().toISOString().slice(11,19),...a);

async function waitForVersion(){
 const want=process.env.EXPECT_SHA;if(!want)return;
 for(let i=0;i<40;i++){
  const v=await fetch(BASE+'/version.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
  if(v?.sha===want){log('새 화면 확인',want.slice(0,7));return}
  await new Promise(r=>setTimeout(r,15000));
 }
 throw Error('10분 안에 새 화면이 올라오지 않았어요 (version.json)');
}
async function cleanup(){
 if(process.env.SMOKE_SKIP_CLEANUP)return log('정리 건너뜀(로컬)');
 const {SUPABASE_ACCESS_TOKEN:token,SUPABASE_PROJECT_REF:ref}=process.env;
 if(!token||!ref)throw Error('점검 계정을 지우려면 SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF가 필요해요');
 if(!/^e2e-[a-z0-9-]+@chukchukapp\.kr$/.test(email))throw Error('점검 계정 형식이 아니에요');
 // 이번 계정과, 예전 점검에서 남았을 수 있는 점검 계정(e2e-…@chukchukapp.kr)을 함께 지운다.
 const who="email like 'e2e-%@chukchukapp.kr'";
 // 로그인 계정을 먼저 지운다: 아직 처리 중인 화면 요청이 앱 계정을 다시 만들지 못하게. 그 요청들이 끝날 때까지 기다린 뒤 앱 데이터를 지운다.
 await new Promise(r=>setTimeout(r,8000));
 const q=`delete from auth.users where ${who};`;
 const q2=`select purge_store(id) from app_users where ${who}; delete from account_deletions where user_id in (select id from app_users where ${who}); delete from app_users where ${who};`;
 const run=async query=>{const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query})});const body=await r.text();if(!r.ok)throw Error('점검 계정 정리 실패: HTTP '+r.status+' '+body.slice(0,200));try{return JSON.parse(body)}catch{return body}};
 await run(q);
 await new Promise(r=>setTimeout(r,8000));
 await run(q2);
 const left=await run(`select (select count(*) from auth.users where ${who})::int as auth_n,(select count(*) from app_users where ${who})::int as app_n`);
 const row=Array.isArray(left)?left[0]:left?.result?.[0]??left;
 if(Number(row?.auth_n)!==0||Number(row?.app_n)!==0){const rows=await run(`select id,email,role,created_at from app_users where ${who}`);throw Error('점검 계정이 남았어요: '+JSON.stringify(left)+' '+JSON.stringify(rows).slice(0,600));}
 log('점검 계정 삭제 완료');
}

await waitForVersion();
const browser=await chromium.launch(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{});
let failure=null;
try{
 const p=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 // 외부 광고 측정(메타 픽셀) 요청은 점검에서 막는다: 연결이 오래 열려 있으면 networkidle이 끝나지 않아 우리 화면과 상관없이 실패한다
 await p.route(/(facebook\.(com|net)|fbcdn\.net)/,r=>r.abort());
 const pending=new Map();p.on('request',r=>pending.set(r,Date.now()));p.on('requestfinished',r=>pending.delete(r));p.on('requestfailed',r=>pending.delete(r));
 globalThis.__pending=()=>[...pending.entries()].map(([r,t])=>`${r.method()} ${r.url().replace(/[?#].*$/,'')} ${Date.now()-t}ms`).join(' | ');
 p.setDefaultTimeout(20000);
 // 1) 가입
 await p.goto(BASE+'/signup?role=owner&plan=basic',{waitUntil:'networkidle'});
 // 응답 시간 기록(실패로 치지 않음): 상태 확인·화면 오류 보고가 오래 걸리는지 배포마다 본다
 try{const t=await p.evaluate(async()=>{const m=async(u,o)=>{const t0=performance.now();try{const r=await fetch(u,o);return u+' '+r.status+' '+Math.round(performance.now()-t0)+'ms'}catch(e){return u+' 실패 '+Math.round(performance.now()-t0)+'ms'}};return [await m('/api/status'),await m('/api/client-error',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'slow',message:'배포 점검 응답 시간 확인',path:'/smoke'})})]});log('API 응답 시간',t.join(' · '))}catch(e){log('API 응답 시간 확인 못 함',e.message)}
 await p.fill('input[placeholder="실명을 입력해 주세요"]','점검 사장');
 await p.fill('input[type=email]',email);
 await p.fill('input[aria-label="비밀번호"]',password);
 await p.check('.auth-agree input[type=checkbox]');
 await p.click('text=계정 만들고 다음으로');
 // 2) 가게 만들기
 await p.fill('#store-name',store);await p.fill('#owner-name','점검 사장');
 await p.locator('.industry-picker label').first().click();
 await p.click('text=다음으로 →');
 for(const box of await p.getByRole('checkbox').all())await box.click();
 await p.click('text=30일 무료 체험 시작');
 await p.waitForURL(/\/app/);await p.getByText(store).first().waitFor();
 log('가입·가게 만들기 OK');
 // 3) 로그아웃
 await p.goto(BASE+'/logout');await p.waitForURL(/\/login/);
 log('로그아웃 OK');
 // 4) 다시 로그인
 await p.goto(BASE+'/login?role=owner',{waitUntil:'networkidle'});
 await p.fill('input[type=email]',email);await p.fill('input[aria-label="비밀번호"]',password);
 await p.locator('form button[type=submit]').click();
 await p.getByText(store).first().waitFor();
 log('다시 로그인 OK');
 if(errors.length)throw Error('화면 오류: '+errors.slice(0,3).join(' | '));
}catch(e){failure=e;try{const pages=browser.contexts().flatMap(c=>c.pages());if(pages[0])await pages[0].screenshot({path:'smoke-failure.png',fullPage:true})}catch{}}
finally{await browser.close()}
try{await cleanup()}catch(e){failure=failure||e;console.error(e.message)}
if(failure){console.error('배포 후 점검 실패:',failure.message);try{const x=globalThis.__pending?.();if(x)console.error('끝나지 않은 요청:',x.slice(0,1500))}catch{}process.exit(1)}
log('배포 후 점검 통과');
