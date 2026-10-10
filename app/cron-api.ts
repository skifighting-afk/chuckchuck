// 가이드 57: 매일 작업. GitHub Actions(.github/workflows/daily.yml)가 하루 한 번 부른다.
// - 체험 끝나기 7일·1일 전 사장님 기기로 알림(각 한 번, 자동 결제는 없음을 안내)
// - 기한이 지난 탈퇴 계정 정리(로그인 요청 때 하던 일을 매일도)
// 데이터 삭제(휴가 증빙 30일 등)는 DB의 pg_cron이 매일 한다(purge_expired).
import {trialNotice} from '../lib/plans';
import {notifyUser} from './push-api';
import {processDeletions} from './withdraw-api';
import {alertsFor} from '../lib/alert-sweep';
import {punctuality,lateMemoRule,nextWeekReminder,budgetAlert,workAlerts,scheduleAckReminders,visaAlerts,minWageNotice,digestFilter,dailyDigest} from '../lib/improve2';
import {dailyBrief,weeklyBrief,staleRequests} from '../lib/briefing';
import {weekStartOf,plus as plusD} from '../lib/schedule-rules';
import {upcomingDeadlines} from '../lib/tax-calendar';
import {retentionDue} from '../lib/retention';
import {applyDueRaises} from '../lib/wage-raise';
import {holidaysFor} from '../lib/holidays';
import {loadAttendance} from './attendance-store';
import {closingMissed,noticeReminders,absenceAlerts,careDays,leavePromotion} from '../lib/ops-alerts';
import {ratesFor,hasRatesFor} from '../lib/pay-rules';
import {sendAlimtalk} from '../lib/alimtalk-send';
const json=(d:any,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
function same(a:string,b:string){if(a.length!==b.length)return false;let r=0;for(let i=0;i<a.length;i++)r|=a.charCodeAt(i)^b.charCodeAt(i);return r===0}
export async function trialReminders(env:any,now=Date.now(),notify=(uid:string,m:any)=>notifyUser(env,uid,m)){
 const rows=(await env.DB.prepare("SELECT owner,data::jsonb->'_account' AS a,(data::jsonb->'store'->>'name') AS name FROM stores WHERE data::jsonb->'_account'->>'trialEndsAt' IS NOT NULL").all()).results as any[];
 let sent=0;
 for(const r of rows){
  const a=typeof r.a==='string'?JSON.parse(r.a):r.a,n=trialNotice(a,now);
  if(!n.level||n.level==='ended')continue;
  const done:string[]=typeof a.trialReminded==='string'?(()=>{try{return JSON.parse(a.trialReminded)}catch{return []}})():a.trialReminded||[];if(done.includes(n.level))continue;
  await notify(r.owner,{title:n.level==='1d'?'내일 무료 체험이 끝나요':`무료 체험이 ${n.daysLeft}일 남았어요`,body:`${r.name||'우리 가게'} · 체험이 끝나도 자동으로 결제되지 않아요. 계속 저장하려면 계정·요금제에서 요금제를 골라 주세요.`,url:'/account'});
  await env.DB.prepare("UPDATE stores SET data=jsonb_set(data::jsonb,'{_account,trialReminded}',(CAST(? AS text))::jsonb)::text WHERE owner=?").bind(JSON.stringify([...done,n.level]),r.owner).run();
  sent++;
 }
 return sent;
}
export async function cronApi(request:Request,env:any){
 const key=request.headers.get('x-cron-secret')||'';
 if(request.method!=='POST'||!env.CRON_SECRET||!same(key,env.CRON_SECRET))return json({error:'매일 작업 전용 주소예요. 화면에서는 쓸 수 없으니 이전 화면으로 돌아가 주세요.'},403);
 // 10분마다: 출퇴근·급여일 알림만(지시서 2주차)
 if(request.headers.get('x-cron-task')==='alerts')return json({ok:true,alerts:await alertSweep(env)});
 const reminders=await trialReminders(env);
 const deletions=await processDeletions(env,20).catch(()=>0);
 const contracts=await contractReminders(env).catch(()=>0);
 const backups=await weeklyBackups(env).catch(()=>0);
 const raises=await applyRaises(env).catch(()=>0);
 await env.DB.prepare('DELETE FROM notifications WHERE created_at<?').bind(new Date(Date.now()-90*86400000).toISOString()).run().catch(()=>{});
 return json({ok:true,reminders,deletions,contracts,backups,raises});
}

/** 지시서 045: 예약한 시급 인상을 그날 반영 */
export async function applyRaises(env:any,now=Date.now()){
 const today=new Date(now+9*3600000).toISOString().slice(0,10);let n=0;
 const rows=(await env.DB.prepare("SELECT owner,data,version FROM stores WHERE data LIKE '%wageHistory%' LIMIT 500").all()).results as any[];
 for(const r of rows){let d:any;try{d=JSON.parse(r.data)}catch{continue}const x=applyDueRaises(d.employees||[],today);if(!x.changed)continue;d.employees=x.employees;
  d._audit=[...(d._audit||[]),{id:crypto.randomUUID(),at:new Date(now).toISOString(),actor:{id:'system',name:'자동'},action:'예약한 급여 인상 반영',target:'',before:null,after:null,reason:today}].slice(-1000);
  const u=await env.DB.prepare('UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(d),new Date(now).toISOString(),r.owner,r.version).run();if(u.meta.changes)n++}
 return n;
}
/** 지시서 147: 매주 월요일 가게마다 백업 한 벌(가게 데이터 + 최근 5주 출퇴근), 4주치만 남긴다 */
export async function weeklyBackups(env:any,now=Date.now()){
 const k=new Date(now+9*3600000);if(k.getUTCDay()!==1)return 0;const week=k.toISOString().slice(0,10);let n=0;
 const rows=(await env.DB.prepare('SELECT s.owner,s.data FROM stores s WHERE NOT EXISTS(SELECT 1 FROM store_backups b WHERE b.owner=s.owner AND b.week=?) LIMIT 200').bind(week).all()).results as any[];
 for(const r of rows){let d:any;try{d=JSON.parse(r.data)}catch{continue}
  d.attendance=await loadAttendance(env.DB,r.owner,new Date(now-35*86400000).toISOString(),new Date(now+60000).toISOString()).catch(()=>[]);
  const body=JSON.stringify({format:'chukchuk-weekly-backup/1',week,createdAt:new Date(now).toISOString(),note:'매주 자동 백업 · 최근 5주 출퇴근 포함. 전체 기록은 설정의 전체 내려받기로 받으세요.',store:d});
  await env.DB.prepare('INSERT INTO store_backups(owner,week,data,bytes,created_at) VALUES(?,?,?,?,?) ON CONFLICT(owner,week) DO NOTHING').bind(r.owner,week,body,body.length,new Date(now).toISOString()).run();
  await env.DB.prepare('DELETE FROM store_backups WHERE owner=? AND week NOT IN (SELECT week FROM store_backups WHERE owner=? ORDER BY week DESC LIMIT 4)').bind(r.owner,r.owner).run();n++}
 return n;
}
/** 지시서 9주차: 서명 요청 뒤 2일 넘게 서명하지 않은 계약서 — 직원·사장님에게 다시 알림(3일에 한 번, 최대 3번) */
export async function contractReminders(env:any,now=Date.now(),notify=(uid:string,m:any)=>notifyUser(env,uid,m)){
 const cut=new Date(now-2*86400000).toISOString(),again=new Date(now-3*86400000).toISOString();
 const rows=(await env.DB.prepare("SELECT id,owner_id,employee_user_id,document_json,created_at,reminded_at,version FROM contract_envelopes WHERE status='waiting' AND created_at<? AND (reminded_at IS NULL OR reminded_at<?) AND created_at>? LIMIT 200").bind(cut,again,new Date(now-11*86400000).toISOString()).all()).results||[];
 let n=0;for(const r of rows as any[]){let d:any={};try{d=JSON.parse(r.document_json)}catch{}
  const days=Math.floor((now-Date.parse(r.created_at))/86400000);
  await notify(r.employee_user_id,{title:'근로계약서 서명이 아직이에요',body:`${d.storeName||'매장'}에서 ${days}일 전에 서명을 요청했어요. 내용을 확인하고 서명해 주세요.`,url:'/contracts',kind:'staff'});
  await notify(r.owner_id,{title:`${d.employeeName||'직원'}님이 아직 계약서에 서명하지 않았어요`,body:`서명 요청 ${days}일째예요. 직원에게 다시 알렸어요. 근로계약서는 일을 시작할 때 써서 주어야 해요.`,url:'/app?screen=contracts',kind:'staff'});
  await env.DB.prepare('UPDATE contract_envelopes SET reminded_at=? WHERE id=?').bind(new Date(now).toISOString(),r.id).run();n++}
 return n;
}

/** 매장마다 지금 보낼 출퇴근 알림을 보내고, 보낸 key를 _alertsSent에 남겨 한 번만 보낸다(3일 지나면 정리). */
export async function alertSweep(env:any,now=Date.now(),notify=(uid:string,m:any)=>notifyUser(env,uid,m)){
 const rows=(await env.DB.prepare('SELECT owner,data FROM stores').all()).results as any[];let sent=0;
 // 출시 준비: 광고성 정보 수신 동의 2년마다 다시 확인(정보통신망법 시행령 제62조의3) — 오전 9시 첫 점검에 한 번
 {const k=new Date(now+9*3600000);if(k.getUTCHours()===9&&k.getUTCMinutes()<10){const two=new Date(now-730*86400000).toISOString(),month=new Date(now-30*86400000).toISOString();
  const due=((await env.DB.prepare("SELECT id,marketing_at FROM app_users WHERE marketing_at<>'' AND marketing_at<? AND marketing_checked_at<? LIMIT 500").bind(two,month).all().catch(()=>({results:[]}))).results||[]) as any[];
  for(const u of due){await notify(u.id,{title:'광고성 정보 수신 동의를 확인해 주세요',body:`${String(u.marketing_at).slice(0,10)}에 소식 받기에 동의하셨어요. 계속 받으려면 그대로 두고, 그만 받으려면 내 계정에서 끄세요.`,url:'/withdraw',kind:'account'});await env.DB.prepare('UPDATE app_users SET marketing_checked_at=?,marketing_at=? WHERE id=?').bind(new Date(now).toISOString(),new Date(now).toISOString(),u.id).run();sent++}}}
 for(const r of rows){
  let d:any;try{d=JSON.parse(r.data)}catch{continue}
  if(!d?.employees||!d?.shifts)continue;
  // 출퇴근 기록은 attendance_records 테이블에 있다: 어제~지금만 읽는다
  d.attendance=await loadAttendance(env.DB,r.owner,new Date(now-2*86400000).toISOString(),new Date(now+60000).toISOString()).catch(()=>[]);
  const leaves=(d._operations?.leaves||[]).filter((l:any)=>l.status==='승인');
  const list:any[]=alertsFor({...d,approvedLeaves:leaves,availability:d._operations?.availability||{}},now);
  // 지시서 081·073: 매일 아침 8시 브리핑, 월요일엔 지난주 리포트도(사장님 알림 설정에서 끌 수 있음)
  {const k=new Date(now+9*3600000),today=k.toISOString().slice(0,10);
   if(k.getUTCHours()===(Number(d.settings?.more?.briefHour)||8)){const b=dailyBrief({...d,leavesPending:(d._operations?.leaves||[]).filter((l:any)=>l.status==='승인 대기').length},today);list.push({key:'brief:'+today,to:'owner',kind:'brief',title:'☀ '+b.title,body:b.body});
    if(k.getUTCDay()===1){const wk=await loadAttendance(env.DB,r.owner,new Date(Date.parse(today+'T00:00:00+09:00')-8*86400000).toISOString(),new Date(now).toISOString()).catch(()=>[]);const w=weeklyBrief({...d,attendance:wk},today);list.push({key:'weekly:'+today,to:'owner',kind:'brief',title:w.title,body:w.body});}}}
  // 지시서 067·052: 마감 체크 없이 퇴근 · 24시간 지나도 안 읽은 공지
  list.push(...closingMissed(d,now),...noticeReminders(d,now),...careDays(d,now),...leavePromotion(d,now));
  // 개선 2차: B005 휴게 끝·B006 휴게 없이 4시간·B014 16시간 열린 기록 · B035 근무표 미확인 · B090 체류 기간 · B058 12월 내년 최저임금
  list.push(...nextWeekReminder(d,now),...budgetAlert(d,now),...workAlerts(d,now),...scheduleAckReminders(d,now),...(new Date(now+9*3600000).getUTCHours()>=9?visaAlerts(d,now):[]));
  {const k=new Date(now+9*3600000);if(k.getUTCHours()>=9){const ny=k.getUTCFullYear()+1,nm=hasRatesFor(ny)?ratesFor(ny).minimumWage:undefined;list.push(...minWageNotice(d,now,nm))}}
  // B015 하루 요약: 켜 두면 사장님 낱개 미출근·퇴근 누락 알림을 빼고 저녁 9시에 한 번
  {const on=!!d.settings?.more?.digest;if(on){const kept=digestFilter(list,true);list.length=0;list.push(...kept);const k=new Date(now+9*3600000);if(k.getUTCHours()===21){const tol=({lenient:10,normal:5,strict:0} as any)[d.settings?.attendanceTolerance||'normal'];const g=dailyDigest(d,now,tol);if(g)list.push(g)}}}
  // B043 명세서를 보낸 지 24시간이 지나도 안 연 직원에게 한 번(72시간 지나면 그만)
  {const rows2=((await env.DB.prepare("SELECT p.id,p.employee_id FROM payslip_documents p LEFT JOIN document_activity a ON a.kind='payslip' AND a.document_id=p.id WHERE p.owner_id=? AND p.created_at<? AND p.created_at>? AND a.viewed_at IS NULL LIMIT 200").bind(r.owner,new Date(now-24*3600000).toISOString(),new Date(now-72*3600000).toISOString()).all().catch(()=>({results:[]}))).results||[]) as any[];
   for(const p of rows2)list.push({key:'slipremind:'+p.id,to:p.employee_id,kind:'payroll',title:'아직 열어 보지 않은 급여명세서가 있어요',body:'급여명세서를 열어 금액을 확인해 주세요. 이상한 항목은 명세서에서 바로 물어볼 수 있어요.',url:'/app?screen=documents'})}
  // 지시서 010: 결근·지각 누적 — 하루 한 번(오전 9시 첫 점검)만 이번 달 기록을 읽는다
  {const k=new Date(now+9*3600000);if(k.getUTCHours()===9&&k.getUTCMinutes()<10){const month=k.toISOString().slice(0,7),full=await loadAttendance(env.DB,r.owner,new Date(Date.parse(month+'-01T00:00:00+09:00')).toISOString(),new Date(now).toISOString()).catch(()=>null);if(full)list.push(...absenceAlerts({...d,attendance:full},month,now));
    // 개선 2차 B151 자동 규칙: 이번 달 지각이 정한 횟수가 되면 직원 메모에 한 줄(한 달에 한 번)
    const lm=Number(d.settings?.more?.lateMemo)||0;if(lm&&full){const tol=({lenient:10,normal:5,strict:0} as any)[d.settings?.attendanceTolerance||'normal']??5,adds:[string,string][]=[];for(const e of (d.employees||[]).filter((e:any)=>e.status!=='퇴사')){const p=punctuality(d.shifts,full as any,e.id,month,tol,now),line=lateMemoRule(e,p.late,month,lm);if(line)adds.push([e.id,line])}
     if(adds.length){const cur=await env.DB.prepare('SELECT data,version FROM stores WHERE owner=?').bind(r.owner).first();if(cur){const dd=JSON.parse(cur.data);for(const [id,line] of adds){const e=dd.employees.find((x:any)=>x.id===id);if(e){const memo=e.extra?.memo||'';if(!memo.includes(`${month} 지각`))e.extra={...(e.extra||{}),memo:((memo?memo+'\n':'')+line).slice(-2000)}}}
      await env.DB.prepare('UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(dd),new Date(now).toISOString(),r.owner,cur.version).run();d.employees=dd.employees}}}}}
  // 지시서 195: 3일 넘게 대기 중인 요청 — 하루 한 번(오전 9시 이후) 사장님께
  {const k=new Date(now+9*3600000),today=k.toISOString().slice(0,10);if(k.getUTCHours()>=9){const st=staleRequests(d,now);if(st.total)list.push({key:'stale:'+today,to:'owner',kind:'leave',title:`3일 넘게 기다리는 요청 ${st.total}건`,body:st.text+' · 직원이 답을 기다리고 있어요.'})}}
  // 지시서 199: 근무표 자동 게시 — 정해 둔 요일·시각에 다음 주 근무표를 공개하고 직원에게 알림
  {const ap=d.settings?.autoPublish,k=new Date(now+9*3600000);if(ap&&k.getUTCDay()===ap.weekday&&k.getUTCHours()===ap.hour){const ws=d.settings?.weekStart==='sun'?'sun':'mon',today=k.toISOString().slice(0,10),next=plusD(weekStartOf(today,ws),7),pw={...(d.publishedWeeks||{})};const fresh:string[]=[];
   for(const b of d.branches||[]){const key=b.id+':'+next,ids=new Set((d.employees||[]).filter((e:any)=>e.branchId===b.id&&e.status!=='퇴사').map((e:any)=>e.id));if(pw[key]||!(d.shifts||[]).some((x:any)=>ids.has(x.employeeId)&&x.date>=next&&x.date<=plusD(next,6)))continue;pw[key]={at:new Date(now).toISOString(),acks:{}};fresh.push(b.id)}
   if(fresh.length){const cur=await env.DB.prepare('SELECT data,version FROM stores WHERE owner=?').bind(r.owner).first();if(cur){const dd=JSON.parse(cur.data);dd.publishedWeeks={...(dd.publishedWeeks||{}),...Object.fromEntries(fresh.map(b=>[b+':'+next,pw[b+':'+next]]))};dd._audit=[...(dd._audit||[]),{id:crypto.randomUUID(),at:new Date(now).toISOString(),actor:{id:'system',name:'자동'},action:'근무표 공개',target:next,before:null,after:{week:next,auto:true},reason:'자동 게시'}].slice(-1000);
    const u=await env.DB.prepare('UPDATE stores SET data=?,version=version+1,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(dd),new Date(now).toISOString(),r.owner,cur.version).run();
    if(u.meta.changes){d._alertsSent=dd._alertsSent;for(const e of (d.employees||[]).filter((e:any)=>fresh.includes(e.branchId)&&e.status!=='퇴사')){const uid=(d._members||[]).find((m:any)=>m.employeeId===e.id)?.userId;if(uid)await notify(uid,{title:'다음 주 근무표가 공개됐어요',body:`${Number(next.slice(5,7))}월 ${Number(next.slice(8))}일부터 일주일 근무표를 확인하고 '확인했어요'를 눌러 주세요.`,url:'/app?screen=schedule',kind:'schedule'})}list.push({key:'autopub:'+next,to:'owner',kind:'schedule',title:'다음 주 근무표를 자동으로 공개했어요',body:'직원 확인 현황은 근무 스케줄 화면에서 볼 수 있어요.'})}}}}}
  // 지시서 130: 보존 기간(퇴사 후 3년)이 지난 퇴사자 개인정보 — 매달 1일 아침 알림
  {const k=new Date(now+9*3600000),today=k.toISOString().slice(0,10);if(k.getUTCDate()===1&&k.getUTCHours()>=9){const due=retentionDue(d.employees||[],today);if(due.length)list.push({key:'retention:'+today.slice(0,7),to:'owner',kind:'staff',title:`보존 기간이 지난 퇴사자 ${due.length}명이 있어요`,body:'설정 → 개인정보 보존 기간에서 연락처를 지워 주세요. 법정 보존 기간(3년)이 지났어요.'})}}
  // 지시서 115·116: 신고·납부 기한 3일 전·당일 아침 9시 이후 사장님께
  {const k=new Date(now+9*3600000),today=k.toISOString().slice(0,10);if(k.getUTCHours()>=9){const y=Number(today.slice(0,4)),hol=new Set([...holidaysFor(y,true).keys(),...holidaysFor(y+1,true).keys()]);
   for(const x of upcomingDeadlines(today,d.employees||[],3,hol)){const left=Math.round((Date.parse(x.date)-Date.parse(today))/86400000);if(left===3||left===0)list.push({key:`tax:${x.date}:${x.title}:${left}`,to:'owner',kind:'payroll',title:left?`${x.title} 기한이 3일 남았어요`:`오늘이 ${x.title} 기한이에요`,body:`${Number(x.date.slice(5,7))}월 ${Number(x.date.slice(8))}일까지 · ${x.detail}`})}}}
  if(!list.length)continue;
  const prev=typeof d._alertsSent==='string'?(()=>{try{return JSON.parse(d._alertsSent)}catch{return {}}})():d._alertsSent||{},done:Record<string,number>={...prev};let changed=false;
  for(const a of list){if(done[a.key])continue;
   const uid=a.to==='owner'?r.owner:(d._members||[]).find((m:any)=>m.employeeId===a.to)?.userId;
   if(uid){await notify(uid,{title:a.title,body:a.body,url:a.url||'/app',kind:a.kind});sent++}
   if(a.kind==='clockout'&&a.to!=='owner'){const e=d.employees.find((x:any)=>x.id===a.to);await sendAlimtalk(env,e?.phone,'CLOCKOUT_MISSING',{이름:e?.name||'',날짜:new Date(now+9*3600000).toISOString().slice(5,10).replace('-','/')}).catch(()=>null)}
   done[a.key]=now;changed=true}
  if(changed){for(const k of Object.keys(done))if(now-done[k]>(/^(absentcnt|latecnt):/.test(k)?35:3)*86400000)delete done[k];
   await env.DB.prepare("UPDATE stores SET data=jsonb_set(data::jsonb,'{_alertsSent}',(CAST(? AS text))::jsonb)::text WHERE owner=?").bind(JSON.stringify(done),r.owner).run()}
 }
 return sent;
}
