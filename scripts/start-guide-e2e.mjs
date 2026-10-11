import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
export async function startGuideE2E({owner,srv,step,browser,watch}){
 const row=await srv.db.q('SELECT owner,data FROM stores LIMIT 1').first(),original=JSON.parse(row.data),state=await owner.context().storageState();
 const c1=await browser.newContext({storageState:state,serviceWorkers:'block',viewport:{width:1280,height:900}}),c2=await browser.newContext({storageState:state,serviceWorkers:'block',viewport:{width:390,height:844}}),a=await c1.newPage(),b=await c2.newPage();watch(a);watch(b);
 const go=p=>p.goto(srv.ORIGIN+'/app',{waitUntil:'networkidle'}),full=p=>p.getByRole('heading',{name:'🎮 사장님 퀘스트',exact:true}).waitFor(),folded=p=>p.locator('.qb-mini').filter({hasText:'사장님 퀘스트'}).waitFor();
 const save=async(p,fn)=>{const response=p.waitForResponse(r=>r.url().includes('/start-guide')&&r.request().method()==='PATCH');await fn();return (await response).json()};
 try{
  await srv.db.q('DELETE FROM start_guide_preferences WHERE owner=?',row.owner).run();
  const initial=structuredClone(original);initial.branches[0].address='';await srv.db.q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(initial),row.owner).run();
  await step('시작 안내 · 두 기기 숨김과 다시 열기 · 마지막 단계 복원',async()=>{
   await go(a);await go(b);await full(a);await full(b);
   await save(a,()=>a.locator('.qb-head').getByRole('button',{name:'접기',exact:true}).click());await folded(a);await b.reload({waitUntil:'networkidle'});await folded(b);
   await save(b,()=>b.locator('.qb-mini').filter({hasText:'사장님 퀘스트'}).click());await full(b);
   await a.reload({waitUntil:'networkidle'});await full(a);await a.locator('.qb-node').filter({hasText:'가게 간판 달기'}).click();await a.locator('.qh-hud').getByText('가게 간판 달기').waitFor();
   await a.waitForTimeout(850);await b.reload({waitUntil:'networkidle'});await b.locator('.qh-hud').getByText('가게 간판 달기').waitFor();await save(b,()=>b.getByRole('button',{name:'퀘스트 그만하기'}).click());
  });
  await step('시작 안내 · 매장과 다른 계정 분리 · 320/390/768/1440 · 키보드',async()=>{
   await go(a);await full(a);await save(a,()=>a.locator('.qb-head').getByRole('button',{name:'접기',exact:true}).click());
   const d=structuredClone(original);d.branches.push({...d.branches[0],id:'guide-other-branch',name:'안내 테스트 별점'});await srv.db.q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(d),row.owner).run();
   await a.goto(srv.ORIGIN+'/app?branch=guide-other-branch',{waitUntil:'networkidle'});await full(a);
   const u=await srv.auth.user('guide-e2e-other',{email:'guide-other@example.invalid',password:'Guide-other-2026'});const other=structuredClone(original);other._members=[];other._coowners=[];await srv.db.q('INSERT INTO stores VALUES(?,?,?,?)',u.id,JSON.stringify(other),1,new Date().toISOString()).run();
   await b.goto(srv.ORIGIN+'/logout');await b.waitForURL(/\/login/);await b.goto(srv.ORIGIN+'/login?role=owner',{waitUntil:'networkidle'});await b.fill('input[type=email]',u.email);await b.fill('input[aria-label="비밀번호"]','Guide-other-2026');await b.locator('form button[type=submit]').click();await b.waitForURL(url=>!url.pathname.startsWith('/login'));await b.getByRole('checkbox',{name:'이용약관과 개인정보 처리방침 동의',exact:true}).check();await b.getByRole('button',{name:'동의하고 계속하기'}).click();await go(b);await full(b);
   for(const width of [320,390,768,1440]){await b.setViewportSize({width,height:900});assert(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'guide overflow '+width)}
   await b.setViewportSize({width:390,height:844});await b.addStyleTag({content:'html{font-size:20px}'});assert(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'large font guide overflow');
   const later=b.locator('.qb-head').getByRole('button',{name:'내일 할게요'});await later.focus();await b.keyboard.press('Enter');await b.getByRole('button',{name:'시작 안내 다시 열기',exact:true}).waitFor();await save(b,()=>b.getByRole('button',{name:'시작 안내 다시 열기',exact:true}).click());await full(b);
   await mkdir('ci-logs',{recursive:true});await b.screenshot({path:'ci-logs/start-guide-mobile.png',fullPage:true});
  });
  await step('시작 안내 · 연결 실패 재시도와 다른 기기 충돌 · 업무 화면 유지',async()=>{
   const guideRequests=[];const trace=r=>{if(r.url().includes('/start-guide'))guideRequests.push({url:r.url(),status:r.status()})};a.on('response',trace);
   await a.route('**/start-guide?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'합성 안내 연결 실패'})}));await go(a);
   try{await a.getByRole('alert').getByText('합성 안내 연결 실패',{exact:false}).waitFor()}catch(e){await mkdir('ci-logs',{recursive:true});await a.screenshot({path:'ci-logs/start-guide-failure.png',fullPage:true});console.error('Guide failure diagnostics',JSON.stringify({requests:guideRequests,alerts:await a.getByRole('alert').allTextContents(),page:await a.locator('body').innerText()}));throw e}finally{a.off('response',trace)}
   await a.getByRole('heading',{name:'우리 가게',exact:false}).first().waitFor();
   await a.unroute('**/start-guide?*');await a.getByRole('button',{name:'안내 다시 시도'}).click();await folded(a);await save(a,()=>a.locator('.qb-mini').filter({hasText:'사장님 퀘스트'}).click());await full(a);
   await srv.db.q('UPDATE start_guide_preferences SET revision=revision+1 WHERE owner=? AND branch_id=?',row.owner,original.branches[0].id).run();
   await a.locator('.qb-head').getByRole('button',{name:'접기',exact:true}).click();await a.getByRole('alert').getByText('다른 기기에서 안내를 바꿨어요.',{exact:false}).waitFor();await a.getByRole('button',{name:'최신 안내 확인'}).click();await full(a);
  });
  await step('매니저 안내 · 위임 업무만 표시 · 단계 복원 · 권한 회수',async()=>{
   const u=await srv.auth.user('guide-e2e-manager',{email:'guide-manager@example.invalid',password:'Guide-manager-2026',role:'employee'}),d=structuredClone(original);
   d.employees.push({...structuredClone(d.employees[0]),id:'guide-manager-employee',name:'안내 매니저',access:'중간관리자',managerPermissions:['schedule']});d._members.push({userId:u.id,employeeId:'guide-manager-employee'});await srv.db.q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(d),row.owner).run();
   await b.goto(srv.ORIGIN+'/logout');await b.waitForURL(/\/login/);await b.goto(srv.ORIGIN+'/login?role=employee',{waitUntil:'networkidle'});await b.fill('input[type=email]',u.email);await b.fill('input[aria-label="비밀번호"]','Guide-manager-2026');await b.locator('form button[type=submit]').click();await b.waitForURL(url=>!url.pathname.startsWith('/login'));await b.getByRole('checkbox',{name:'이용약관과 개인정보 처리방침 동의',exact:true}).check();await b.getByRole('button',{name:'동의하고 계속하기'}).click();await b.goto(srv.ORIGIN+'/manager',{waitUntil:'networkidle'});
   const guide=b.getByRole('region',{name:'매니저 시작 안내'});await guide.getByRole('button',{name:'근무표 등록',exact:true}).waitFor();assert.equal(await guide.getByRole('button',{name:'휴가 신청 확인'}).count(),0);
   await save(b,()=>guide.getByRole('button',{name:'근무표 등록',exact:true}).click());await guide.getByText('근무표 등록 · 1/4').waitFor();await save(b,()=>guide.getByRole('button',{name:'다음 안내'}).click());await b.reload({waitUntil:'networkidle'});await guide.getByText('근무표 등록 · 2/4').waitFor();assert.deepEqual(JSON.parse((await srv.db.q('SELECT data FROM stores WHERE owner=?',row.owner).first()).data),d);
   d.employees.at(-1).managerPermissions=[];await srv.db.q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(d),row.owner).run();await b.getByRole('button',{name:'새로 확인',exact:true}).click();await guide.getByText('아직 맡은 관리 업무가 없어요.',{exact:false}).waitFor();assert.equal(await guide.getByRole('button',{name:'근무표 등록',exact:true}).count(),0);
  });
 }finally{await c1.close();await c2.close();await srv.db.q('DELETE FROM stores WHERE owner=?','native:guide-e2e-other').run();await srv.db.q('UPDATE stores SET data=?,version=version+1 WHERE owner=?',JSON.stringify(original),row.owner).run()}
}
