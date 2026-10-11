import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
export async function schedulePublicationE2E({page,staff,srv,step}){
 await step('근무표 공개 상태 · 미확인 대상만 재알림 · 작은 화면',async()=>{
  const saved=await srv.db.q('SELECT owner,data FROM stores LIMIT 1').first();
  const own=await page.evaluate(async()=>{const r=await fetch('/api/store');if(!r.ok)throw Error('owner fixture read '+r.status);return r.json()});
  const personal=await staff.evaluate(async()=>{const r=await fetch('/api/store');if(!r.ok)throw Error('staff fixture read '+r.status);return r.json()});
  const self=own.state.employees.find(e=>e.id===personal.selfId),other=own.state.employees.find(e=>e.branchId===self.branchId&&e.id!==self.id&&e.status!=='퇴사');
  assert(other,'acknowledged same-store colleague fixture');const anchor='2030-10-14',key=self.branchId+':'+anchor,at=new Date().toISOString();
  async function put(state,version){return page.evaluate(async({state,version})=>{const r=await fetch('/api/store',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,version})});const data=await r.json();if(!r.ok)throw Error(JSON.stringify(data));return data},{state,version})}
  try{
   const state=JSON.parse(saved.data);state.publishedWeeks={...state.publishedWeeks,[key]:{at,acks:{[other.id]:at}}};state.shifts.push({id:'ux-pub-shift',employeeId:self.id,date:anchor,start:'10:00',end:'14:00',breakMinutes:0});
   await srv.db.q('UPDATE stores SET data=? WHERE owner=?',JSON.stringify(state),saved.owner).run();let current;
   await page.goto(srv.ORIGIN+'/app?screen=schedule',{waitUntil:'networkidle'});await page.getByLabel('근무표 날짜',{exact:true}).fill(anchor);await page.getByRole('button',{name:'주간 · 7일 한눈에',exact:true}).click();
   const bar=page.getByRole('region',{name:'근무표 공개·확인',exact:true});await bar.getByText('공개됨',{exact:true}).waitFor();
   await bar.getByRole('button',{name:/미확인 .*명 보기/}).click();await bar.locator('.publish-recipients').getByText(self.name,{exact:true}).waitFor();
   assert(!(await bar.locator('.publish-recipients').innerText()).includes(other.name),'acked person excluded from pending names');
   await bar.getByRole('button',{name:'미확인 직원에게만 알림 요청',exact:true}).click();await bar.getByRole('status').waitFor();
   const raw=JSON.parse((await srv.db.q('SELECT data FROM stores WHERE owner=?',saved.owner).first()).data);assert.equal(raw.publishedWeeks[key].acks[other.id],at);
   const target=raw._members.find(m=>m.employeeId===self.id).userId;
   const notices=(await srv.db.q('SELECT user_id FROM notifications WHERE title=?','근무표 확인을 부탁드려요').all()).results;assert.deepEqual(notices.map(n=>n.user_id),[target]);
   await bar.getByRole('button',{name:'다시 공개·알림',exact:true}).click();await bar.getByText('전체 직원에게 다시 공개할까요?',{exact:true}).waitFor();
   await page.getByLabel('근무표 날짜',{exact:true}).fill('2030-10-21');assert.equal(await bar.getByText('전체 직원에게 다시 공개할까요?',{exact:true}).count(),0,'changing week clears republish confirmation');
   await page.getByLabel('근무표 날짜',{exact:true}).fill(anchor);assert.equal(await bar.getByText('전체 직원에게 다시 공개할까요?',{exact:true}).count(),0,'returning cannot reuse old confirmation');assert.equal(await bar.getByRole('status').count(),0,'old reminder feedback cannot cross contexts');
   current=await page.evaluate(async()=>{const r=await fetch('/api/store');return r.json()});current.state.shifts.find(s=>s.id==='ux-pub-shift').end='15:00';await put(current.state,current.version);
   await page.reload({waitUntil:'networkidle'});await page.getByLabel('근무표 날짜',{exact:true}).fill(anchor);await page.getByRole('button',{name:'주간 · 7일 한눈에',exact:true}).click();await bar.getByText('공개 후 변경',{exact:true}).waitFor();
   await bar.getByRole('button',{name:/미확인 .*명 보기/}).click();
   for(const large of [false,true]){
    if(large){await page.locator('.owner-display-settings summary').click();await page.getByRole('button',{name:'글씨 더 크게 보기',exact:true}).click()}
    for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'publish recipient overflow '+width+' large='+large)}
   }
   await page.getByRole('button',{name:'기본 글씨로 보기',exact:true}).click();await page.setViewportSize({width:390,height:844});await bar.scrollIntoViewIfNeeded();await mkdir('ci-logs',{recursive:true});await page.screenshot({path:'ci-logs/schedule-publication-mobile.png'});
  }finally{await srv.db.q('UPDATE stores SET data=? WHERE owner=?',saved.data,saved.owner).run();await page.setViewportSize({width:1440,height:900})}
 });
}
