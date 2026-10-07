// 지시서 086: 캘린더 구독 — 직원이 만든 비밀 주소를 구글·애플·삼성 달력에 넣으면 근무표가 저절로 따라 바뀐다.
// GET /api/ics?t=비밀값 (로그인 없이, 달력 앱이 가져감) · POST (직원 로그인) 주소 만들기·끄기
import {resolveStore} from './saas-api';
import {serverError} from '../lib/errors';
import {shiftsToIcs} from '../lib/ics';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hash=async(t:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('ics:'+t)))).map(n=>n.toString(16).padStart(2,'0')).join('');
export async function icsApi(request:Request,env:{DB:D1Database}){
 try{
 const url=new URL(request.url);
 if(request.method==='GET'&&url.searchParams.get('t')){
  const t=url.searchParams.get('t')!;if(!/^[a-f0-9]{48}$/.test(t))return new Response('주소가 맞지 않아요. 앱에서 달력 주소를 다시 만들어 주세요.',{status:404});
  const row=await env.DB.prepare('SELECT owner,employee_id FROM calendar_tokens WHERE token_hash=?').bind(await hash(t)).first<any>();if(!row)return new Response('꺼진 주소예요. 앱에서 달력 주소를 다시 만들어 주세요.',{status:404});
  const st=await env.DB.prepare('SELECT data FROM stores WHERE owner=?').bind(row.owner).first<any>();if(!st)return new Response('가게를 찾을 수 없어요. 사장님께 확인해 주세요.',{status:404});
  const d=JSON.parse(st.data),e=(d.employees||[]).find((x:any)=>x.id===row.employee_id);if(!e||e.status==='퇴사')return new Response('지금은 근무표를 볼 수 없어요. 사장님께 확인해 주세요.',{status:404});
  const from=new Date(Date.now()-14*86400000+9*3600000).toISOString().slice(0,10),to=new Date(Date.now()+90*86400000+9*3600000).toISOString().slice(0,10);
  const branch=(d.branches||[]).find((b:any)=>b.id===e.branchId),store=String(d.store?.name||'척척사장')+(branch&&d.branches.length>1?' '+branch.name:'');
  const shifts=(d.shifts||[]).filter((s:any)=>s.employeeId===e.id&&s.date>=from&&s.date<=to).map((s:any)=>({id:s.id,date:s.date,start:s.start,end:s.end,title:store+' 근무'+(s.position?` (${s.position})`:''),place:branch?.address||''}));
  return new Response(shiftsToIcs(store,shifts),{headers:{'Content-Type':'text/calendar; charset=utf-8','Cache-Control':'private, max-age=900','X-Content-Type-Options':'nosniff'}});
 }
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
 const linked=await resolveStore(env.DB,user);if(!linked||linked.access==='revoked')return json({error:'먼저 매장에 연결해 주세요. 사장님께 초대를 요청해 주세요.'},403);
 const d=JSON.parse(linked.row.data),self=(d.employees||[]).find((e:any)=>e.id===d._members?.find((m:any)=>m.userId===user)?.employeeId);
 if(!self)return json({error:'직원 계정에서만 달력 주소를 만들 수 있어요. 직원으로 로그인해 주세요.'},403);
 if(request.method==='GET'){const r=await env.DB.prepare('SELECT created_at FROM calendar_tokens WHERE owner=? AND employee_id=?').bind(linked.owner,self.id).first<any>();return json({on:!!r,createdAt:r?.created_at||null})}
 if(request.method!=='POST')return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},405);
 if(request.headers.get('origin')!==url.origin)return json({error:'요청 출처를 확인할 수 없어요. 척척사장 화면을 새로고침한 뒤 다시 시도해 주세요.'},403);
 const b:any=await request.json().catch(()=>({}));
 await env.DB.prepare('DELETE FROM calendar_tokens WHERE owner=? AND employee_id=?').bind(linked.owner,self.id).run();
 if(b.action==='off')return json({on:false});
 const t=Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('');
 await env.DB.prepare('INSERT INTO calendar_tokens(token_hash,owner,employee_id,created_at) VALUES(?,?,?,?)').bind(await hash(t),linked.owner,self.id,new Date().toISOString()).run();
 const feed=new URL('/api/ics?t='+t,request.url).href;
 return json({on:true,url:feed,webcal:feed.replace(/^https?:/,'webcal:')});
 }catch(e){return serverError('ics',e,'달력 주소를 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
