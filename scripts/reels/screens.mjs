// 릴스에 넣을 실제 앱 화면: 체험 화면(/demo)을 휴대폰 크기로 열어 주제에 맞는 화면을 찍는다.
// 체험 화면은 예시 가게라 실제 고객 정보가 나오지 않는다.
const SCREEN={
 payroll:['juhu-rule','overtime','night','holiday-work','public-holiday','mayday','under5','finalize','unlock','pdf','payslip-law','accountant','pay-day','ledger','insurance-rule','insurance-report','durunuri','three-three','probation','absence-juhu','meal','withholding','income-tax','daily-worker','two-jobs','swap-pay','labor-office','send-how','late-deduct'],
 schedule:['copy-week','template','draft','print','break-rule','week-52'],
 attendance:['qr-setup','qr-dynamic','correction-how','break-how','cctv'],
 contracts:['contract-penalty','esign','minor-rule','wage-down'],
 employees:['excel-staff','invite','preview-staff','manager','dismiss','resign','retire-paper','records-keep'],
 retirement:['severance','severance-calc'],
 operations:['annual-leave','leave-approve','notice','maternity','rules-10','harassment','shutdown'],
 manual:['manual'],
 stores:['add-branch','multi-store','headcount-rule'],
};
export const screenFor=id=>Object.entries(SCREEN).find(([,ids])=>ids.includes(id))?.[0]||'home';
const LABEL={payroll:'급여 계산',schedule:'근무표',attendance:'출퇴근 기록',contracts:'근로계약서',employees:'직원 관리',retirement:'퇴직금 확인',operations:'휴가·공지',manual:'매장 매뉴얼',stores:'매장 비교',home:'오늘 가게'};
export const screenLabel=s=>LABEL[s]||'척척사장';

/** 화면 두 장(처음 모습 · 한 단계 더) png 경로 */
export async function captureScreens(browser,site,id,outDir){
 const screen=screenFor(id),ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul'});
 const page=await ctx.newPage(),shots=[];
 try{
  await page.goto(site.replace(/\/$/,'')+'/demo?screen='+screen,{waitUntil:'networkidle',timeout:45000});
  await page.waitForTimeout(800);
  // 위쪽 체험 안내 띠는 빼고 앱 부분부터 보이게
  await page.evaluate(()=>{const bar=document.querySelector('.demo-toolbar,[class*="demo-bar"]');if(bar)bar.style.display='none';scrollTo(0,0)}).catch(()=>{});
  const a=outDir+'/screen-1.png';await page.screenshot({path:a});shots.push(a);
  // 한 단계 더: 급여는 계산 근거 열기, 근무표는 주간 보기, 나머지는 아래로 조금 내리기
  if(screen==='payroll'&&await page.locator('button:has-text("계산 근거")').count()){await page.locator('button:has-text("계산 근거")').first().click();await page.waitForTimeout(700)}
  else if(screen==='schedule'&&await page.locator('button:has-text("주간")').count()){await page.locator('button:has-text("주간")').first().click();await page.waitForTimeout(600)}
  else{await page.evaluate(()=>scrollBy(0,520));await page.waitForTimeout(400)}
  const b=outDir+'/screen-2.png';await page.screenshot({path:b});shots.push(b);
 }catch(e){console.log('앱 화면을 찍지 못해 건너뛰어요: '+e.message)}
 await ctx.close();
 return {screen,label:screenLabel(screen),shots};
}
