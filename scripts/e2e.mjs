// 작업 080: 화면 E2E — 사장님·직원 핵심 흐름을 실제 화면으로 돌린다.
// 로컬 서버(scripts/e2e-server.mjs: 화면 + 서버 코드 + 가짜 로그인 + 테스트 Postgres)를 띄우고 Playwright로 누른다.
// 실행 전: 화면을 SUPABASE_URL=http://localhost:8790, SUPABASE_ANON_KEY=anon-test-key로 빌드(npm run e2e가 해 줌)
import {chromium,devices} from 'playwright';
import {startE2EServer} from './e2e-server.mjs';

const srv=await startE2EServer();const B=srv.ORIGIN;
const browser=await chromium.launch(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{});
const errors=[];let n=0;
const watch=p=>{p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message))};
let extra=null;async function step(name,fn){const t=Date.now();try{await fn();console.log(`PASS ${++n}. ${name} (${Date.now()-t}ms)`)}catch(e){console.error(`FAIL ${name}: ${e.message.split('\n').slice(0,14).join('\n')}`);if(extra)await extra.screenshot({path:'e2e-failure-extra.png',fullPage:true}).catch(()=>{});for(const [i,p] of [owner,staff].filter(Boolean).entries())await p.screenshot({path:`e2e-failure-${i?'staff':'owner'}.png`,fullPage:true}).catch(()=>{});await browser.close();await srv.close();process.exit(1)}}
const kToday=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const OWNER={name:'김사장',email:'boss@example.invalid',password:'Boss-pass-2026'},STAFF={name:'이직원',email:'staff@example.invalid',password:'Staff-pass-2026'};

const ownerCtx=await browser.newContext({viewport:{width:1280,height:900},timezoneId:'Asia/Seoul',locale:'ko-KR'});const owner=await ownerCtx.newPage();watch(owner);
// 직원은 휴대폰(아이폰 크기·터치)으로 쓴다.
const staffCtx=await browser.newContext({...devices['iPhone 13'],browserName:undefined,defaultBrowserType:undefined,timezoneId:'Asia/Seoul',locale:'ko-KR'});const staff=await staffCtx.newPage();watch(staff);
const qrConfirm=async kind=>{await staff.click(`button:has-text("${kind}")`);await staff.click('text=휴대폰 카메라로 연 QR 확인하기');await staff.click(`text=${kind} 기록하기`)};
let joinLink,qrLink,qrPng;

await step('사장님 가입 (약관 동의)',async()=>{
 await owner.goto(B+'/signup?role=owner&plan=pro',{waitUntil:'networkidle'});
 await owner.fill('input[placeholder="실명을 입력해 주세요"]',OWNER.name);await owner.fill('input[type=email]',OWNER.email);await owner.fill('input[aria-label="비밀번호"]',OWNER.password);
 if(!await owner.locator('.auth-agree input[required]').count())throw Error('약관 동의 체크가 필수가 아니에요');
 await owner.check('.auth-agree input');await owner.click('text=계정 만들고 다음으로');await owner.locator('#store-name').waitFor();
});
await step('가게 만들기 (요금 고르기·처리위탁 동의·30일 체험)',async()=>{
 await owner.fill('#store-name','점검식당');await owner.fill('#owner-name',OWNER.name);await owner.locator('.industry-picker label').first().click();await owner.click('text=다음으로 →');
 for(const b of await owner.getByRole('checkbox').all())await b.click();
 await owner.click('text=30일 무료 체험 시작');await owner.waitForURL(/\/app/);await owner.getByText('점검식당').first().waitFor();
});
await step('가입용 근로조건 정하고 가입 링크 만들기',async()=>{
 await owner.goto(B+'/staff-requests',{waitUntil:'networkidle'});
 await owner.click('text=가게 코드·가입 링크 만들기');await owner.click('text=직원이 가입할 때 확인할 근로조건 설정');
 const f=(label,v)=>owner.fill(`label:has-text("${label}") input`,String(v));
 await f('사업주 이름',OWNER.name);await f('근무장소','점검식당');await f('하는 일','홀 서빙');await f('근무요일','월, 수, 금');await f('휴일','매주 일요일');await f('휴가','근로기준법에 따른 연차유급휴가');
 await owner.selectOption('label:has-text("계약 형태") select','단시간');await owner.selectOption('label:has-text("임금 기준") select','시급');
 await f('근무 시작','09:00');await f('근무 종료','14:00');await f('임금 (원)',10320);await f('주 근무시간',15);await f('휴게시간 (분)',30);await f('매월 급여일',10);
 await owner.click('text=가입용 근로조건 저장');await owner.getByText(/저장|반영/).first().waitFor();
 joinLink=await owner.locator('label:has-text("직원 가입 링크") input').inputValue();if(!/\/j\/[A-Z0-9]{8}$/.test(joinLink))throw Error('가입 링크 형식: '+joinLink);
});
await step('직원이 링크로 가입하고 합류 신청 (휴대폰)',async()=>{
 await staff.goto(joinLink,{waitUntil:'networkidle'});
 await staff.fill('input[placeholder="실명을 입력해 주세요"]',STAFF.name);await staff.fill('input[type=email]',STAFF.email);await staff.fill('input[aria-label="비밀번호"]',STAFF.password);await staff.check('.auth-agree input');
 await staff.click('text=계정 만들고 다음으로');await staff.click('text=우리 가게 확인하기');
 await staff.fill('input[type=tel]','010-1234-5678');await staff.fill('input[placeholder="근로계약서에 쓸 주소"]','서울시 가상구 1');await staff.fill('input[type=date]',kToday());
 await staff.click('text=입력한 정보로 다음 단계');await staff.getByText('시급').first().waitFor();
 for(const b of await staff.locator('main input[type=checkbox]').all())await b.check();
 await staff.click('text=사장님께 가입 신청 보내기');await staff.getByText('사장님의 승인을 기다리고 있어요').waitFor();
});
await step('사장님이 합류 신청 수락 → 직원 화면 열림',async()=>{
 await owner.click('text=새 신청 확인');await owner.getByText(STAFF.email).first().waitFor();await owner.click('text=수락하기');await owner.getByText('신청을 처리했어요').waitFor();
 await staff.click('text=사장님이 수락했는지 확인하기');await staff.click('text=내 직원 화면 열기 →');await staff.getByText(`안녕하세요, ${STAFF.name}님`).waitFor();
});
await step('작업 048: 근무표 반복 등록 → 템플릿 저장 → 다음 주에 붙이기',async()=>{
 await owner.goto(B+'/app?screen=schedule',{waitUntil:'networkidle'});await owner.click('button:has-text("주간 · 7일 한눈에")');
 await owner.click('button:has-text("근무 추가")');
 await owner.check('label.repeat-toggle input');
 for(const d of ['월','화','수','목','금']){const box=owner.locator('.repeat-days label',{hasText:d}).locator('input');if(!await box.isChecked())await box.check({force:true})}
 const preview=await owner.locator('.repeat-preview').innerText();if(!/\d+회/.test(preview))throw Error('반복 미리보기 없음: '+preview);
 await owner.click('button:has-text("반복 일정 저장")');await owner.getByText(/근무 \d+회를 등록했어요/).waitFor();
 const before=JSON.parse((await srv.db.q('SELECT data FROM stores LIMIT 1').first()).data).shifts.length;if(before<15)throw Error('반복 등록 수가 적어요: '+before);
 await owner.getByRole('button',{name:'템플릿',exact:true}).click();await owner.fill('label:has-text("새 템플릿 이름") input','평일 기본');await owner.click('button:has-text("이번 주 저장")');await owner.getByText('이번 주 근무를 템플릿으로 저장했어요.').waitFor();await owner.click('[role=dialog] button:has-text("닫기")');
 await owner.locator('input[aria-label="근무표 날짜"]').fill(new Date(Date.now()+9*3600000+35*86400000).toISOString().slice(0,10));
 await owner.getByRole('button',{name:'템플릿',exact:true}).click();await owner.locator('.template-list button:has-text("이 주에 붙이기")').first().click();await owner.getByText(/템플릿 '평일 기본'으로 근무 \d+개를 넣었어요/).waitFor();
 await owner.evaluate(()=>{window.print=()=>{}});await owner.click('button:has-text("인쇄 (A4 가로)")');await owner.emulateMedia({media:'print'});const cells=await owner.locator('.print-sheet tbody td div').count();if(!cells)throw Error('인쇄용 근무표가 비어 있어요');await owner.emulateMedia({media:'screen'});
});
await step('작업 050: 직원이 근무 가능 시간 제출 → 사장님 초안 화면에서 확인',async()=>{
 await staff.goto(B+'/app',{waitUntil:'networkidle'});await staff.click('button:has-text("휴가·공지")');await staff.click('button:has-text("근무 요청")');
 await staff.locator('.avail-row',{hasText:'토요일'}).locator('input[type=checkbox]').check();await staff.click('button:has-text("가능 시간 내기")');await staff.getByText('제출').first().waitFor();
 const av=JSON.parse((await srv.db.q('SELECT data FROM stores LIMIT 1').first()).data)._operations.availability;if(!Object.values(av).some(a=>a.slots.some(x=>x.weekday===6)))throw Error('가능 시간 저장 안 됨');
 await owner.goto(B+'/app?screen=schedule',{waitUntil:'networkidle'});await owner.click('button:has-text("가능 시간으로 초안")');await owner.getByText('근무 가능 시간 낸 직원 1/1명').waitFor();await owner.getByText('토 09:00~18:00').waitFor();await owner.click('[role=dialog] button:has-text("닫기")');
 await staff.goto(B+'/app',{waitUntil:'networkidle'});
});
await step('작업 096: 사장님 홈에 오늘 할 일',async()=>{
 await owner.goto(B+'/app',{waitUntil:'networkidle'});await owner.getByRole('heading',{name:/오늘 할 일/}).waitFor();if(!await owner.evaluate(()=>Promise.race([navigator.serviceWorker.ready.then(r=>!!r.active),new Promise(r=>setTimeout(()=>r(false),8000))])))throw Error('서비스워커가 등록되지 않음');{const m=await owner.request.get(B+'/manifest.webmanifest');if(!m.ok()||(await m.json()).start_url!=='/app')throw Error('manifest 없음')}
 await owner.click('button.text-size-toggle[title]');if(!await owner.evaluate(()=>document.documentElement.classList.contains('large-text')))throw Error('글씨 크게 안 됨');await owner.reload({waitUntil:'networkidle'});if(!await owner.evaluate(()=>document.documentElement.classList.contains('large-text')))throw Error('글씨 크게 설정이 유지되지 않음');await owner.click('button.text-size-toggle[title]');
 const text=await owner.locator('.today-tasks').innerText();if(!/근로계약서 미체결|처리할 일이 없어요/.test(text))throw Error('오늘 할 일 내용 이상: '+text);
});
await step('매장 매뉴얼: 사장님이 사진과 함께 작성 → 직원이 바로 확인',async()=>{
 await owner.goto(B+'/app?screen=manual',{waitUntil:'networkidle'});await owner.click('button:has-text("새 매뉴얼")');
 await owner.fill('label:has-text("제목") input','마감 청소 순서');await owner.fill('label:has-text("1단계") textarea','바닥을 쓸고 대걸레로 닦아요');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
 await owner.locator('.manual-upload input[type=file]').first().setInputFiles({name:'floor.png',mimeType:'image/png',buffer:png});await owner.locator('.manual-steps img.manual-img').waitFor();
 await owner.click('button:has-text("저장하고 직원에게 보이기")');await owner.getByText('매뉴얼을 저장했어요').waitFor();
 await staff.goto(B+'/app',{waitUntil:'networkidle'});await staff.click('button:has-text("매뉴얼")');await staff.click('button:has-text("마감 청소 순서")');
 await staff.getByText('바닥을 쓸고 대걸레로 닦아요').waitFor();await staff.locator('.manual-view img.manual-img').waitFor();await staff.getByText('확인함').waitFor();
 await staff.goto(B+'/app',{waitUntil:'networkidle'});
});
await step('매장 QR로 출근·퇴근 (QR 없이 누르면 기록 안 됨)',async()=>{
 await staff.click('button:has-text("출근")');await staff.getByText('출근 전에 매장 QR을 찍어 주세요').waitFor();await staff.click('text=취소 · 기록하지 않기');
 await owner.goto(B+'/app?screen=attendance',{waitUntil:'networkidle'});await owner.locator('button:has-text("출퇴근 QR")').first().click();
 qrLink=await owner.locator('a:has-text("QR 대신 출근 화면 열기")').getAttribute('href');
 // 사장님 화면이 만든 실제 QR 이미지(매장에 붙일 것)를 저장해 둔다 — 작업 052에서 사진으로 읽힌다.
 qrPng=await owner.locator('img[alt="출퇴근 화면 접속 QR코드"]').screenshot();
 await owner.click('text=닫기');
 await staff.goto(qrLink,{waitUntil:'networkidle'});await qrConfirm('출근');await staff.getByText('근무 중입니다.').waitFor();
 await qrConfirm('퇴근');await staff.getByText('오늘 근무를 마쳤어요.').waitFor();
});
await step('직원 출퇴근 정정 요청',async()=>{
 await staff.locator('button:has-text("수정 요청")').first().click();
 // 출근을 4시간 앞당겨 달라는 요청(퇴근은 그대로 — 미래 시각이 되면 다음 출근과 겹친다)
 const start=staff.locator('label:has-text("출근 일시") input');const t=new Date(await start.inputValue()+':00Z');t.setUTCMinutes(t.getUTCMinutes()-240);await start.fill(t.toISOString().slice(0,16));
 await staff.fill('textarea','오픈 준비 시간이 빠졌어요');await staff.click('text=수정 요청 보내기');await staff.getByText('오픈 준비 시간이 빠졌어요 · 승인 대기').waitFor();
});
await step('사장님 정정 승인 → 이력 기록',async()=>{
 await owner.goto(B+'/app?screen=attendance',{waitUntil:'networkidle'});await owner.click('button:has-text("사장님 승인")');
 await owner.getByText('수정 승인 · '+STAFF.name).first().waitFor();
 const d=JSON.parse((await srv.db.q('SELECT data FROM stores LIMIT 1').first()).data);
 if(!d.requests.some(r=>r.status==='승인'))throw Error('정정 요청이 승인 상태가 아니에요');
});
await step('작업 052: 안드로이드 휴대폰에서 매장 QR 사진으로 출근·퇴근',async()=>{
 const ctx=await browser.newContext({...devices['Pixel 7'],timezoneId:'Asia/Seoul',locale:'ko-KR'});const a=await ctx.newPage();watch(a);extra=a;
 await a.goto(B+'/login?role=employee',{waitUntil:'networkidle'});
 await a.fill('input[type=email]',STAFF.email);await a.fill('input[aria-label="비밀번호"]',STAFF.password);await a.locator('form button[type=submit]').click();
 await a.click('text=내 직원 화면 열기 →');await a.getByText(`안녕하세요, ${STAFF.name}님`).waitFor();
 await a.getByRole('button',{name:/^(다시 )?출근$/}).click(); // 자정이 지나면 '출근', 같은 날이면 '다시 출근'await a.getByText('출근 전에 매장 QR을 찍어 주세요').waitFor();
 await a.setInputFiles('input[type=file]',{name:'qr.png',mimeType:'image/png',buffer:qrPng});
 await a.getByText('QR을 읽었어요.').waitFor();await a.click('text=출근 기록하기');await a.getByText('근무 중입니다.').waitFor();
 await a.click('button:has-text("퇴근")');await a.setInputFiles('input[type=file]',{name:'qr.png',mimeType:'image/png',buffer:qrPng});await a.click('text=퇴근 기록하기');await a.getByText('오늘 근무를 마쳤어요.').waitFor();
 await ctx.close();
});
await step('급여 확정 (지급일·확인 체크)',async()=>{
 await owner.goto(B+'/app?screen=payroll',{waitUntil:'networkidle'});await owner.locator('button:has-text("계산 근거")').first().click();await owner.getByText(/출퇴근 기록 \d+건/).waitFor();await owner.locator('.basis-line').first().click();await owner.locator('.basis-detail').first().waitFor();await owner.click('[role=dialog] button:has-text("닫기")');await owner.click('button:has-text("급여 검토·확정")');await owner.getByText(/마감 전 확인/).waitFor();
 await owner.check('label:has-text("수당·공제·근무 누락") input');await owner.click('button:has-text("급여 확정")');await owner.getByText('급여 확정 · 잠금').first().waitFor();
 const pay=await owner.locator('table').first().innerText();if(!/[1-9][\d,]*원/.test(pay))throw Error('확정 급여가 0원이에요: '+pay.slice(0,200));
});
await step('명세서 보내기 → 직원이 열어 봄 (확인 기록)',async()=>{
 await owner.click('button:has-text("직원 앱으로 보내기")');await owner.getByText(/보냄 · 수정본 1/).first().waitFor();
 await staff.goto(B+'/app',{waitUntil:'networkidle'});await staff.click('button:has-text("내 급여")');await staff.locator('button:has-text("수정본 1 열기")').click();
 await staff.getByText('임금지급일:').waitFor();await staff.getByText(/확인함/).first().waitFor();
 const act=await srv.db.q("SELECT viewed_at FROM document_activity WHERE kind='payslip'").first();if(!act?.viewed_at)throw Error('명세서 열람 기록이 없어요'); const [dl]=await Promise.all([staff.waitForEvent('download'),staff.click('button:has-text("PDF로 저장")')]);const pdfPath=await dl.path();const head=(await import('node:fs')).readFileSync(pdfPath).subarray(0,8).toString('latin1');if(!head.startsWith('%PDF-1.4'))throw Error('PDF 저장 실패: '+head+' '+dl.suggestedFilename());
});
await step('근로계약서: 사장님 서명 → 직원 서명 → 사본',async()=>{
 await owner.goto(B+'/contracts',{waitUntil:'networkidle'});await owner.click('text=새 계약서 만들기');
 await owner.selectOption('label:has-text("직원 선택") select',{label:STAFF.name});
 const fills={'시작 시각':'11:00','종료 시각':'11:30'};
 const body=(await owner.locator('textarea').inputValue()).replace(/\[([^\]]*)\]/g,(_,k)=>fills[k]??({'년 월 일':'2026년 10월 4일'}[k])??'확인함');await owner.fill('textarea',body);
 await owner.fill('label:has-text("사업주 성명") input',OWNER.name);await owner.fill('label:has-text("현재 비밀번호") input',OWNER.password);await owner.check('label:has-text("사업주로서") input');
 {const box=await owner.locator('.sig-pad canvas').boundingBox();await owner.mouse.move(box.x+20,box.y+box.height/2);await owner.mouse.down();for(let i=1;i<=10;i++)await owner.mouse.move(box.x+20+i*25,box.y+box.height/2+(i%2?15:-15));await owner.mouse.up();await owner.getByText('지우고 다시 그리기').waitFor();}
 await owner.click('text=서명하고 직원에게 확인 요청');
 {let row=null;for(let i=0;i<20&&!row;i++){row=await srv.db.q('SELECT owner_signature FROM contract_envelopes ORDER BY created_at DESC LIMIT 1').first();if(!row)await owner.waitForTimeout(300)}if(!row)throw Error('계약서가 저장되지 않음');if(!JSON.parse(row.owner_signature).drawing?.startsWith('data:image/png;base64,'))throw Error('손서명 저장 안 됨');}await owner.getByText(/직원 서명|서명 대기|확인 요청/).first().waitFor();
 await staff.goto(B+'/contracts',{waitUntil:'networkidle'});await staff.getByText(STAFF.name).first().waitFor();
 await staff.locator('.contract-list-item').first().click();
 await staff.fill('label:has-text("성명") input',STAFF.name);await staff.fill('label:has-text("현재 비밀번호") input',STAFF.password);
 for(const b of await staff.locator('.contract-sign-form input[type=checkbox]').all())await b.check();
 await staff.locator('.contract-sign-form button[type=submit], .contract-sign-form button:has-text("서명")').first().click();
 await staff.waitForTimeout(800);
 const row=await srv.db.q("SELECT status,employee_signature FROM contract_envelopes LIMIT 1").first();
 if(row?.status!=='signed'||!row.employee_signature)throw Error('계약서가 양측 서명 상태가 아니에요: '+row?.status);
});
await step('작업 044: 30초마다 바뀌는 QR 화면',async()=>{
 await owner.goto(B+'/app?screen=attendance',{waitUntil:'networkidle'});await owner.locator('button:has-text("출퇴근 QR")').first().click();await owner.locator('.t-qr img').waitFor();await owner.waitForLoadState('networkidle');
 await owner.click('button:has-text("30초마다 바뀌는 QR 켜기")');
 const [screen]=await Promise.all([owner.context().waitForEvent('page'),owner.click('a:has-text("매장 화면에 QR 띄우기")')]);await screen.waitForLoadState('networkidle');await screen.locator('.live-qr img').waitFor();await screen.getByText(/\d+초 뒤 새 QR/).waitFor();await screen.close();
 await owner.click('button:has-text("인쇄용 고정 QR로 되돌리기")');await owner.getByText('30초마다 바뀌는 QR 켜기').waitFor();
});
await step('작업 051: 어제 퇴근 누락 → 직원 화면 안내 → 정정 요청',async()=>{
 const row=await srv.db.q('SELECT owner,data FROM stores LIMIT 1').first();const d=JSON.parse(row.data);const eid=d._members[0].employeeId;
 const y=new Date(Date.now()-86400000*2).toISOString();await srv.db.q("INSERT INTO attendance_records(owner,id,employee_id,start_at,record) VALUES(?,?,?,?,?)",row.owner,'missed-1',eid,y,JSON.stringify({id:'missed-1',employeeId:eid,start:y,end:null,breakMinutes:0,breakStart:null})).run();
 await staff.goto(B+'/app',{waitUntil:'networkidle'});await staff.getByText(/퇴근 기록이 없어요/).waitFor();await staff.click('button:has-text("퇴근 시각 정정 요청")');await staff.getByText('출퇴근 수정 요청').first().waitFor();
 await srv.db.q("DELETE FROM attendance_records WHERE id='missed-1'").run();
});
await step('작업 054: 직원 여러 명 붙여넣기 등록',async()=>{
 await owner.goto(B+'/app?screen=employees',{waitUntil:'networkidle'});await owner.click('button:has-text("여러 명 붙여넣기")');
 await owner.fill('textarea[aria-label="직원 표 붙여넣기"]','붙임직원\t010-0000-0000\tbulk@example.invalid\t2026-10-05\t시급\t10320\t15\t주방\n오류직원\t\t\t\t연봉\tabc');
 await owner.locator('.bulk-err').first().waitFor();await owner.click('button:has-text("1명 등록")');
 await owner.getByText(/직원 1명을 '입사 준비'로 등록했어요/).waitFor();await owner.getByText('붙임직원').first().waitFor();
});
await step('다시 로그인 (로그아웃 후)',async()=>{
 await staff.goto(B+'/logout');await staff.waitForURL(/\/login/);await staff.goto(B+'/login?role=employee',{waitUntil:'networkidle'});
 await staff.fill('input[type=email]',STAFF.email);await staff.fill('input[aria-label="비밀번호"]',STAFF.password);await staff.locator('form button[type=submit]').click();
 await staff.click('text=내 직원 화면 열기 →');await staff.getByText(`안녕하세요, ${STAFF.name}님`).waitFor();
});
if(errors.length){console.error('화면 오류:',errors.slice(0,5));await browser.close();await srv.close();process.exit(1)}
console.log(`E2E ${n}개 흐름 통과`);
await browser.close();await srv.close();process.exit(0);
