// Uses the existing isolated E2E store and authenticated owner/staff pages.
// Every scenario changes the UI, reloads it, then checks the real PostgreSQL row.
import assert from 'node:assert/strict';
export async function hrE2E({owner,staff,srv,step,staffName}){
 const B=srv.ORIGIN,store=JSON.parse((await srv.db.q('SELECT data FROM stores LIMIT 1').first()).data),emp=store.employees.find(e=>e.name===staffName).id;
 const open=(p,view)=>p.goto(B+'/hr?view='+view,{waitUntil:'networkidle'}),field=(p,name)=>p.getByRole('textbox',{name}),select=(p,name)=>p.getByRole('combobox',{name,exact:true});
 const save=async(p,name)=>{const [res]=await Promise.all([p.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/hr/')),p.getByRole('button',{name,exact:true}).click()]);assert(res.ok(),await res.text());await p.waitForFunction(label=>!Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()===label&&b.disabled),name);return(await res.json()).record};
 const row=async(table,id)=>{const r=await srv.db.q('SELECT data FROM '+table+' WHERE id=?',id).first();assert(r,'saved database row');return typeof r.data==='string'?JSON.parse(r.data):r.data};
 let candidate,buddy,assignment,skill,meeting,hrCase,campaign,item;
 await step('HR01 채용 결정 → 입사 준비 직원 연결 → 재조회',async()=>{
  await open(owner,'hiring');await field(owner,'지원자 이름').fill('HR 예시 입사자');await field(owner,'희망 업무').fill('바리스타');candidate=await save(owner,'지원 내용 저장');
  await select(owner,'변경할 지원 상태').selectOption('채용 결정');candidate=await save(owner,'상태 저장');await owner.getByRole('checkbox',{name:'채용 결정과 연결할 직원을 확인했어요.',exact:true}).check();candidate=await save(owner,'직원과 연결');buddy=candidate.convertedEmployeeId;
  await owner.reload({waitUntil:'networkidle'});assert.equal((await row('hr_candidates',candidate.id)).convertedEmployeeId,buddy);const d=JSON.parse((await srv.db.q('SELECT data FROM stores LIMIT 1').first()).data);assert.equal(d.employees.find(e=>e.id===buddy).status,'입사 준비');
  await open(staff,'hiring');assert.equal(await staff.getByRole('button',{name:'채용 지원자',exact:true}).count(),0);
 });
 await step('HR03 선배 교육 요청 → 직원 확인 → 재조회',async()=>{
  await open(owner,'training');await owner.getByText('새 교육 계획 만들기',{exact:true}).click();await select(owner,'교육받을 직원').selectOption(emp);await select(owner,'함께할 선배').selectOption(buddy);await owner.getByLabel('교육 시작일',{exact:true}).fill(new Date(Date.now()+9*3600000).toISOString().slice(0,10));await owner.getByLabel('교육 종료일',{exact:true}).fill('2099-12-31');await field(owner,'1번째 배울 내용').fill('HR 오픈 순서');assignment=await save(owner,'교육 계획 저장');await field(owner,'HR 오픈 순서 교육 메모').fill('함께 연습했어요.');assignment=await save(owner,'직원에게 확인 요청');
  await open(staff,'training');assignment=await save(staff,'이 내용을 배웠어요');await staff.reload({waitUntil:'networkidle'});assert.equal((await row('hr_buddy_assignments',assignment.id)).steps[0].progress,'done');
 });
 await step('HR04 담당자 숙련 확인 → 직원 재확인 요청',async()=>{
  await open(owner,'training');await field(owner,'업무 이름').fill('HR 음료 준비');skill=await save(owner,'업무 추가');await select(owner,'확인할 직원').selectOption(emp);await select(owner,'확인할 업무').selectOption(skill.id);await select(owner,'확인한 수준').selectOption('도움받으면 가능');const r=await save(owner,'숙련도 확인 저장');
  await open(staff,'training');await save(staff,'다시 확인해 주세요');await staff.reload({waitUntil:'networkidle'});assert((await row('hr_skill_records',r.id)).reviewRequestedAt);
 });
 await step('HR05 희망 근무량 저장 → HR06 편성 근거·검토',async()=>{
  await open(staff,'staffing');await staff.getByRole('spinbutton',{name:'최소 희망량',exact:true}).fill('12');await staff.getByRole('spinbutton',{name:'최대 희망량',exact:true}).fill('24');const r=await save(staff,'내 희망 저장');
  await open(owner,'staffing');await field(owner,'희망 근무량 검토 메모').fill('편성 전 확인');await save(owner,'검토 기록 남기기');await owner.reload({waitUntil:'networkidle'});assert((await row('hr_work_preferences',r.id)).reviewedAt);await owner.getByText(/계산에 사용한 근무/).first().waitFor();
 });
 await step('HR07 비공개 면담 메모 → 공유 요약·직원 확인',async()=>{
  await open(owner,'meetings');await owner.getByText('새 면담 준비하기',{exact:true}).click();await select(owner,'면담 직원').selectOption(emp);await field(owner,'면담 주제').fill('HR 첫 주 면담');await owner.getByLabel('면담 일시 · 한국 시간').fill('2026-11-01T14:00');await field(owner,'직원에게 공유할 요약').fill('오픈 순서를 같이 연습해요');await field(owner,'담당자 비공개 메모').fill('HR-E2E-PRIVATE');meeting=(await save(owner,'면담 내용 저장')).meeting;
  await owner.getByRole('checkbox',{name:'요약과 약속을 해당 직원에게 공유하는 것을 확인했어요.',exact:true}).check();meeting=(await save(owner,'직원에게 공유')).meeting;
  await open(staff,'meetings');assert.equal((await staff.locator('main').innerText()).includes('HR-E2E-PRIVATE'),false);await save(staff,'공유 내용 확인했어요');await staff.reload({waitUntil:'networkidle'});assert((await row('hr_meetings',meeting.id)).ackAt);
 });
 await step('HR08 실명 상담 → 409 입력 보존 → 답변 재조회',async()=>{
  await open(staff,'cases');await staff.getByText('내 이름으로 의견·상담 남기기',{exact:true}).click();await field(staff,'의견·상담 제목').fill('HR 교육 의견');await field(staff,'전하고 싶은 이야기').fill('오픈 순서를 더 연습하고 싶어요');await staff.getByRole('checkbox').check();hrCase=(await save(staff,'의견·상담 접수')).record;
  await open(owner,'cases');await owner.getByRole('button',{name:'대화 확인',exact:true}).click();await field(owner,'상담 대화에 남길 내용').fill('함께 연습해요');const pattern='**/hr/cases**';await owner.route(pattern,r=>r.request().method()==='POST'?r.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'다른 곳에서 바뀐 기록이에요.'})}):r.continue());await owner.getByRole('button',{name:'대화 남기기',exact:true}).click();await owner.getByRole('alert').filter({hasText:'다른 곳에서'}).waitFor();assert.equal(await field(owner,'상담 대화에 남길 내용').inputValue(),'함께 연습해요');await owner.unroute(pattern);await owner.route(pattern,r=>r.request().method()==='GET'?r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'시험 연결 실패'})}):r.continue());await owner.getByRole('button',{name:'입력 유지하고 최신 기록 확인',exact:true}).click();await owner.getByRole('alert').filter({hasText:'최신 기록을 불러오지 못했어요.'}).waitFor();assert.equal(await field(owner,'상담 대화에 남길 내용').inputValue(),'함께 연습해요');assert.equal(await owner.locator('.hr-notice').filter({hasText:'최신 기록을 불러왔어요.'}).count(),0);await owner.unroute(pattern);await owner.getByRole('button',{name:'입력 유지하고 최신 기록 확인',exact:true}).click();await owner.waitForFunction(()=>document.activeElement?.tagName==='TEXTAREA');assert.equal(await field(owner,'상담 대화에 남길 내용').inputValue(),'함께 연습해요');await save(owner,'대화 남기기');await staff.reload({waitUntil:'networkidle'});await staff.getByRole('button',{name:'대화 확인',exact:true}).click();await staff.getByText('함께 연습해요',{exact:true}).waitFor();assert.equal((await row('hr_cases',hrCase.id)).status,'answered');
 });
 await step('HR09 실명 자발 설문 → 응답·분포 재조회',async()=>{
  await open(owner,'pulse');await owner.getByText('짧은 설문 만들기',{exact:true}).click();await field(owner,'설문 제목').fill('HR 첫 주 안내');await field(owner,'질문 1').fill('안내가 충분했나요?');await owner.getByRole('checkbox',{name:staffName,exact:true}).check();await owner.getByLabel('응답 시작 · 한국 시간').fill('2026-01-01T00:00');await owner.getByLabel('응답 마감 · 한국 시간').fill('2099-12-31T23:59');campaign=await save(owner,'초안 저장');await save(owner,'대상 직원에게 공개');
  await open(staff,'pulse');await select(staff,'안내가 충분했나요?').selectOption('4');await staff.getByRole('checkbox').check();await save(staff,'내 응답 저장');await owner.reload({waitUntil:'networkidle'});await owner.getByText(/응답 1명 \/ 대상 1명/).waitFor();assert.equal(Number((await srv.db.q('SELECT count(*) AS n FROM hr_pulse_answers WHERE campaign_id=?',campaign.id).first()).n),1);
 });
 await step('HR10 지급2 → 직원 수령 → 부분 반납1 → 재조회',async()=>{
  await open(owner,'items');await owner.getByText('직원에게 물품 지급하기',{exact:true}).click();await select(owner,'물품을 받을 직원').selectOption(emp);await field(owner,'물품 이름·키 별칭').fill('HR 유니폼');await owner.getByRole('spinbutton',{name:'지급 수량',exact:true}).fill('2');item=await save(owner,'지급 기록 저장');await open(staff,'items');await save(staff,'이 물품을 받았어요');await open(owner,'items');await owner.getByText('부분 반납·반납 요청·분실 기록',{exact:true}).click();await save(owner,'처리 기록 저장');await owner.reload({waitUntil:'networkidle'});assert.equal((await row('hr_item_assignments',item.id)).returned,1);assert((await row('hr_item_assignments',item.id)).receivedAt);
 });
}
