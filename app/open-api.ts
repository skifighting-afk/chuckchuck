// 지시서 090: 오픈 API·웹훅 — 사내 ERP·회계 프로그램이 가게 자료를 읽어 가고(읽기 전용), 출퇴근·급여 확정이 생기면 알림(웹훅)을 받는다.
// 읽기: GET /api/open/v1/{employees|shifts|attendance|payroll}  헤더 X-Api-Key: ck_…
// 관리(사장님 로그인): /api/open-admin  키 만들기·끄기, 웹훅 주소 정하기·시험 보내기
import {resolveStore} from './saas-api';
import {authLimit} from './auth-api';
import {loadAttendance} from './attendance-store';
import {serverError} from '../lib/errors';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const sha=async(t:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const kst=(iso:string)=>new Date(Date.parse(iso)+9*3600000).toISOString().slice(0,10);
const okDate=(v:string|null)=>!!v&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v));
export async function openApi(request:Request,env:{DB:D1Database}){
 try{
 if(request.method!=='GET')return json({error:'읽기(GET)만 할 수 있어요.'},405);
 const key=request.headers.get('x-api-key')||'';if(!/^ck_[a-f0-9]{40}$/.test(key))return json({error:'X-Api-Key 헤더에 척척사장 API 키를 넣어 주세요.'},401);
 const h=await sha('apikey:'+key);if(!await authLimit(env as any,'openapi:'+h,120,60000))return json({error:'요청이 너무 많아요. 1분에 120번까지라 잠시 뒤 다시 보내 주세요.'},429);
 const k=await env.DB.prepare('SELECT owner FROM api_keys WHERE key_hash=?').bind(h).first<any>();if(!k)return json({error:'꺼졌거나 없는 키예요. 사장님께 새 키를 받아 주세요.'},401);
 await env.DB.prepare('UPDATE api_keys SET last_used_at=? WHERE key_hash=?').bind(new Date().toISOString(),h).run().catch(()=>null);
 const row=await env.DB.prepare('SELECT data FROM stores WHERE owner=?').bind(k.owner).first<any>();if(!row)return json({error:'가게를 찾을 수 없어요. 사장님께 새 키를 받아 주세요.'},404);
 const d=JSON.parse(row.data),url=new URL(request.url),what=url.pathname.replace(/^\/api\/open\/v1\//,''),br=new Map((d.branches||[]).map((b:any)=>[b.id,b.name]));
 const range=()=>{const from=url.searchParams.get('from'),to=url.searchParams.get('to');if(!okDate(from)||!okDate(to)||to!<from!)return null;if((Date.parse(to!)-Date.parse(from!))/86400000>93)return 'long';return {from:from!,to:to!}};
 if(what==='employees')return json({employees:(d.employees||[]).map((e:any)=>({id:e.id,name:e.name,branch:br.get(e.branchId)||'',role:e.role,status:e.status,employment:e.employment,joined:e.joined,endDate:e.endDate||null,payType:e.payType}))});
 if(what==='shifts'||what==='attendance'){const r=range();if(!r)return json({error:'from·to를 YYYY-MM-DD로 넣어 주세요.'},400);if(r==='long')return json({error:'한 번에 93일까지만 가져올 수 있어요.'},400);
  if(what==='shifts')return json({shifts:(d.shifts||[]).filter((s:any)=>s.date>=r.from&&s.date<=r.to).map((s:any)=>({id:s.id,employeeId:s.employeeId,date:s.date,start:s.start,end:s.end,breakMinutes:s.breakMinutes,branch:br.get(s.branchId||(d.employees||[]).find((e:any)=>e.id===s.employeeId)?.branchId)||''}))});
  const att=await loadAttendance(env.DB,k.owner,new Date(Date.parse(r.from+'T00:00:00+09:00')).toISOString(),new Date(Date.parse(r.to+'T00:00:00+09:00')+86400000).toISOString());
  return json({attendance:att.map((a:any)=>({id:a.id,employeeId:a.employeeId,date:kst(a.start),start:a.start,end:a.end,breakMinutes:Math.round(a.breakMinutes||0),paidStart:a.credit?.start||null,paidEnd:a.credit?.end||null,source:a.source==='owner'?'owner':'staff'}))})}
 if(what==='payroll'){const m=url.searchParams.get('month')||'';if(!/^\d{4}-\d{2}$/.test(m))return json({error:'month를 YYYY-MM으로 넣어 주세요.'},400);
  const runs=Object.values<any>(d.payrollRuns||{}).filter(r=>r.locked&&r.month===m);return json({month:m,runs:runs.map(r=>({branch:br.get(r.branch)||'',payDate:r.payDate,revision:r.revision||1,rows:(r.rows||[]).map((x:any)=>({employeeId:x.employeeId,name:x.name,hours:x.hours,gross:x.gross,deduction:x.deduction,net:x.net,earnings:(x.earnings||[]).map((e:any)=>({name:e.name,amount:e.amount})),deductions:(x.deductions||[]).map((e:any)=>({name:e.name,amount:e.amount}))}))}))})}
 return json({error:'없는 주소예요. employees·shifts·attendance·payroll 중에서 골라 주세요.'},404);
 }catch(e){return serverError('open-api',e,'자료를 가져오지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
/** 웹훅 보내기: 본문을 비밀값으로 서명(X-Chukchuk-Signature: sha256=…), 5초 안에 답이 없으면 그만 */
export async function sendWebhooks(data:any,event:string,payload:any){
 const hooks=(data?._webhooks||[]).filter((w:any)=>w.on!==false&&(w.events||[]).includes(event));
 for(const w of hooks){const body=JSON.stringify({event,at:new Date().toISOString(),data:payload});
  const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(w.secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(body)))).map(n=>n.toString(16).padStart(2,'0')).join('');
  const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),5000);await fetch(w.url,{method:'POST',headers:{'Content-Type':'application/json','X-Chukchuk-Event':event,'X-Chukchuk-Signature':'sha256='+sig},body,signal:ctl.signal}).catch(()=>null).finally(()=>clearTimeout(t));}
}
export async function openAdminApi(request:Request,env:{DB:D1Database}){
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
 try{
 const linked=await resolveStore(env.DB,user);if(linked?.access!=='owner')return json({error:'API 키는 사장님만 만들 수 있어요.'},403);
 const view=async()=>{const keys=(await env.DB.prepare('SELECT prefix,label,created_at,last_used_at FROM api_keys WHERE owner=? ORDER BY created_at DESC').bind(linked.owner).all<any>()).results||[];const d=JSON.parse((await env.DB.prepare('SELECT data FROM stores WHERE owner=?').bind(linked.owner).first<any>()).data);return {keys:keys.map((k:any)=>({prefix:k.prefix,label:k.label,createdAt:k.created_at,lastUsedAt:k.last_used_at||null})),webhooks:(d._webhooks||[]).map((w:any)=>({id:w.id,url:w.url,events:w.events,createdAt:w.createdAt}))}};
 if(request.method==='GET')return json(await view());
 const url=new URL(request.url);if(request.method!=='POST'||request.headers.get('origin')!==url.origin)return json({error:'척척사장 화면을 새로고침한 뒤 다시 시도해 주세요.'},403);
 const b:any=await request.json().catch(()=>({}));
 if(b.action==='createKey'){const n=(await env.DB.prepare('SELECT count(*) AS n FROM api_keys WHERE owner=?').bind(linked.owner).first<any>())?.n||0;if(Number(n)>=5)return json({error:'키는 5개까지 만들 수 있어요. 안 쓰는 키를 꺼 주세요.'},400);
  const key='ck_'+Array.from(crypto.getRandomValues(new Uint8Array(20)),x=>x.toString(16).padStart(2,'0')).join('');await env.DB.prepare('INSERT INTO api_keys(key_hash,owner,label,prefix,created_at) VALUES(?,?,?,?,?)').bind(await sha('apikey:'+key),linked.owner,String(b.label||'').slice(0,40)||'API 키',key.slice(0,10),new Date().toISOString()).run();return json({...await view(),key})}
 if(b.action==='revokeKey'){await env.DB.prepare('DELETE FROM api_keys WHERE owner=? AND prefix=?').bind(linked.owner,String(b.prefix||'')).run();return json(await view())}
 if(['addHook','removeHook','testHook'].includes(b.action)){
  for(let i=0;i<3;i++){const row=await env.DB.prepare('SELECT data,version FROM stores WHERE owner=?').bind(linked.owner).first<any>();const d=JSON.parse(row.data);let hooks:any[]=d._webhooks||[];let secret:string|undefined;
   if(b.action==='testHook'){const w=hooks.find(x=>x.id===b.id);if(!w)return json({error:'웹훅을 찾을 수 없어요. 목록을 새로고침해 주세요.'},404);await sendWebhooks({_webhooks:[{...w,events:['test']}]},'test',{message:'척척사장 웹훅 시험'});return json({...await view(),sent:true})}
   if(b.action==='addHook'){const u=String(b.url||'').trim();if(!/^https:\/\/[^\s/$.?#].[^\s]{2,300}$/.test(u)||/^https:\/\/(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u))return json({error:'https://로 시작하는 바깥 서버 주소를 넣어 주세요.'},400);if(hooks.length>=3)return json({error:'웹훅은 3개까지예요. 안 쓰는 웹훅을 지운 뒤 추가해 주세요.'},400);
    const ev=(Array.isArray(b.events)?b.events:[]).filter((e:string)=>['attendance.clock','payroll.finalized'].includes(e));if(!ev.length)return json({error:'받을 일을 하나 이상 골라 주세요.'},400);secret=Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,'0')).join('');hooks=[...hooks,{id:crypto.randomUUID(),url:u,events:ev,secret,createdAt:new Date().toISOString()}]}
   else hooks=hooks.filter(x=>x.id!==b.id);
   d._webhooks=hooks;d._audit=[...(d._audit||[]),{id:crypto.randomUUID(),at:new Date().toISOString(),actor:{id:user,name:'사장님'},action:b.action==='addHook'?'웹훅 추가':'웹훅 삭제',target:'오픈 API',before:null,after:null,reason:''}].slice(-1000);
   const r=await env.DB.prepare('UPDATE stores SET data=?,version=?,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(d),row.version+1,new Date().toISOString(),linked.owner,row.version).run();if(r.meta.changes)return json({...await view(),...(secret?{secret}:{})})}
  return json({error:'잠시 뒤 다시 해 주세요.'},409)}
 return json({error:'이 작업은 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},400);
 }catch(e){return serverError('open-admin',e,'처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
