// 가이드 57: 매일 작업. GitHub Actions(.github/workflows/daily.yml)가 하루 한 번 부른다.
// - 체험 끝나기 7일·1일 전 사장님 기기로 알림(각 한 번, 자동 결제는 없음을 안내)
// - 기한이 지난 탈퇴 계정 정리(로그인 요청 때 하던 일을 매일도)
// 데이터 삭제(휴가 증빙 30일 등)는 DB의 pg_cron이 매일 한다(purge_expired).
import {trialNotice} from '../lib/plans';
import {notifyUser} from './push-api';
import {processDeletions} from './withdraw-api';
import {alertsFor} from '../lib/alert-sweep';
import {loadAttendance} from './attendance-store';
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
 await env.DB.prepare('DELETE FROM notifications WHERE created_at<?').bind(new Date(Date.now()-90*86400000).toISOString()).run().catch(()=>{});
 return json({ok:true,reminders,deletions,contracts});
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
 for(const r of rows){
  let d:any;try{d=JSON.parse(r.data)}catch{continue}
  if(!d?.employees||!d?.shifts)continue;
  // 출퇴근 기록은 attendance_records 테이블에 있다: 어제~지금만 읽는다
  d.attendance=await loadAttendance(env.DB,r.owner,new Date(now-2*86400000).toISOString(),new Date(now+60000).toISOString()).catch(()=>[]);
  const leaves=(d._operations?.leaves||[]).filter((l:any)=>l.status==='승인');
  const list=alertsFor({...d,approvedLeaves:leaves,availability:d._operations?.availability||{}},now);if(!list.length)continue;
  const prev=typeof d._alertsSent==='string'?(()=>{try{return JSON.parse(d._alertsSent)}catch{return {}}})():d._alertsSent||{},done:Record<string,number>={...prev};let changed=false;
  for(const a of list){if(done[a.key])continue;
   const uid=a.to==='owner'?r.owner:(d._members||[]).find((m:any)=>m.employeeId===a.to)?.userId;
   if(uid){await notify(uid,{title:a.title,body:a.body,url:'/app',kind:a.kind});sent++}
   if(a.kind==='clockout'&&a.to!=='owner'){const e=d.employees.find((x:any)=>x.id===a.to);await sendAlimtalk(env,e?.phone,'CLOCKOUT_MISSING',{이름:e?.name||'',날짜:new Date(now+9*3600000).toISOString().slice(5,10).replace('-','/')}).catch(()=>null)}
   done[a.key]=now;changed=true}
  if(changed){for(const k of Object.keys(done))if(now-done[k]>3*86400000)delete done[k];
   await env.DB.prepare("UPDATE stores SET data=jsonb_set(data::jsonb,'{_alertsSent}',(CAST(? AS text))::jsonb)::text WHERE owner=?").bind(JSON.stringify(done),r.owner).run()}
 }
 return sent;
}
