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
 const q=`select purge_store(id) from app_users where ${who}; delete from account_deletions where user_id in (select id from app_users where ${who}); delete from app_users where ${who}; delete from auth.users where ${who};`;
 const run=async query=>{const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query})});const body=await r.text();if(!r.ok)throw Error('점검 계정 정리 실패: HTTP '+r.status+' '+body.slice(0,200));try{return JSON.parse(body)}catch{return body}};
 await run(q);
 const left=await run(`select (select count(*) from auth.users where ${who})::int as auth_n,(select count(*) from app_users where ${who})::int as app_n`);
 const row=Array.isArray(left)?left[0]:left?.result?.[0]??left;
 if(Number(row?.auth_n)!==0||Number(row?.app_n)!==0)throw Error('점검 계정이 남았어요: '+JSON.stringify(left).slice(0,200));
 log('점검 계정 삭제 완료');
}

await waitForVersion();
const browser=await chromium.launch(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{});
let failure=null;
try{
 const p=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 p.setDefaultTimeout(20000);
 // 1) 가입
 await p.goto(BASE+'/signup?role=owner&plan=free',{waitUntil:'networkidle'});
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
 await p.click('text=무료로 우리 가게 열기');
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
if(failure){console.error('배포 후 점검 실패:',failure.message);process.exit(1)}
log('배포 후 점검 통과');
