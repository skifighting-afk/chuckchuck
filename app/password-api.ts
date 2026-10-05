// 메일 없이 비밀번호 찾기.
// - 직원: 사장님이 직원 카드에서 임시 비밀번호를 만들어 직접 알려 준다.
// - 사장님: 로그인 화면의 '비밀번호 찾기 요청'으로 본사에 요청 → 본사가 본인 확인(연락처로 전화) 후 임시 비밀번호를 만든다.
// - 임시 비밀번호로 로그인하면 새 비밀번호를 정하기 전에는 다른 화면을 쓸 수 없다.
import {setTempPassword,changeOwnPassword,authLimit} from './auth-api';
import {isHQ} from './admin-api';
import {resolveStore} from './saas-api';
import {notifyUser} from './push-api';
import {serverError} from '../lib/errors';
const json=(d:any,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function passwordApi(request:Request,env:any){
 const url=new URL(request.url);
 if(request.method!=='POST')return json({error:'이 방법으로는 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},405);
 if(request.headers.get('origin')!==url.origin)return json({error:'요청 출처를 확인할 수 없어요. 척척사장봇 화면을 새로고침한 뒤 다시 시도해 주세요.'},403);
 let b:any;try{b=JSON.parse(await request.text())}catch{return json({error:'요청 내용이 올바르지 않아요. 새로고침한 뒤 다시 시도해 주세요.'},400)}
 const uid=request.headers.get('oai-authenticated-user-id');
 try{
  // 로그인 없이: 사장님 비밀번호 찾기 요청 → 본사 문의함으로
  if(b.action==='request'){
   const ip=(request.headers.get('x-forwarded-for')||'').split(',')[0].trim()||'ip';
   if(!await authLimit(env,'pw-request:'+ip,3,3600000))return json({error:'요청이 많아요. 한 시간 뒤 다시 시도해 주세요.'},429);
   const email=String(b.email||'').trim().toLowerCase(),name=String(b.name||'').trim(),phone=String(b.phone||'').replace(/[^\d-]/g,''),store=String(b.store||'').trim();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name||name.length>40||phone.replace(/\D/g,'').length<9||store.length>80)return json({error:'가입한 이메일, 이름, 연락받을 전화번호를 확인해 주세요.'},400);
   await env.DB.prepare('INSERT INTO support_tickets(id,user_id,store_owner,role,category,body,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),'anon:'+email,null,'로그인 못 함','비밀번호 찾기',`가입 이메일: ${email}\n이름: ${name}\n연락처: ${phone}\n가게 이름: ${store||'(안 적음)'}`,new Date().toISOString()).run();
   await notifyUser(env,env.HQ_NATIVE_USER_ID,{title:'비밀번호 찾기 요청',body:`${name} · 본인 확인 후 임시 비밀번호를 만들어 주세요.`,url:'/admin#password'});
   return json({ok:true,message:'요청을 받았어요. 본사에서 적어 주신 번호로 연락해 본인을 확인한 뒤 임시 비밀번호를 알려 드려요.'});
  }
  if(!uid)return json({error:'로그인한 뒤 다시 시도해 주세요.'},401);
  if(b.action==='change'){await changeOwnPassword(env,request,b.password);return json({ok:true})}
  if(b.action==='resetMember'){
   const linked=await resolveStore(env.DB,uid);if(linked?.access!=='owner')return json({error:'직원 비밀번호는 사장님만 초기화할 수 있어요.'},403);
   const data=JSON.parse(linked.row.data),m=(data._members||[]).find((x:any)=>x.employeeId===b.employeeId);
   if(!m)return json({error:'이 직원은 아직 앱 계정이 연결되지 않았어요. 직원이 가입해 합류한 뒤에 초기화할 수 있어요.'},409);
   if(m.userId===uid)return json({error:'사장님 본인 비밀번호는 여기서 바꿀 수 없어요. 로그아웃한 뒤 비밀번호 찾기 요청을 이용해 주세요.'},409);
   if(!await authLimit(env,'pw-reset:'+uid,10,3600000))return json({error:'초기화가 많아요. 한 시간 뒤 다시 시도해 주세요.'},429);
   const pw=await setTempPassword(env,m.userId);if(!pw)return json({error:'직원 계정을 찾지 못했어요. 직원에게 다시 가입하도록 안내해 주세요.'},404);
   const e=(data.employees||[]).find((x:any)=>x.id===b.employeeId);
   for(let t=0;t<3;t++){const row=await env.DB.prepare('SELECT data,version FROM stores WHERE owner=?').bind(uid).first();const d=JSON.parse(row.data);d._audit=[...(d._audit||[]),{id:crypto.randomUUID(),at:new Date().toISOString(),actor:{id:uid,name:'사장님'},action:'직원 비밀번호 초기화',target:e?.name||'',before:null,after:null,reason:''}];
    if((await env.DB.prepare('UPDATE stores SET data=?,version=?,updated_at=? WHERE owner=? AND version=?').bind(JSON.stringify(d),row.version+1,new Date().toISOString(),uid,row.version).run()).meta.changes)break}
   return json({ok:true,tempPassword:pw,name:e?.name||''});
  }
  if(b.action==='resetByEmail'){
   if(!isHQ(request,env))return json({error:'본사 계정만 할 수 있어요.'},403);
   const email=String(b.email||'').trim().toLowerCase(),u=await env.DB.prepare('SELECT id,name FROM app_users WHERE email=?').bind(email).first();
   if(!u)return json({error:'그 이메일로 가입한 계정이 없어요. 철자를 확인해 주세요.'},404);
   const pw=await setTempPassword(env,u.id);
   await env.DB.prepare('INSERT INTO hq_access_log(at,actor,action,target,detail) VALUES(?,?,?,?,?)').bind(new Date().toISOString(),request.headers.get('oai-authenticated-user-email')||uid,'임시 비밀번호 발급',u.id,JSON.stringify({reason:String(b.reason||'').slice(0,200)})).run();
   return json({ok:true,tempPassword:pw,name:u.name});
  }
  return json({error:'이 작업은 처리할 수 없어요. 새로고침한 뒤 다시 시도해 주세요.'},400);
 }catch(e){const m=(e as Error)?.message||'';if(/비밀번호|로그인/.test(m))return json({error:m},400);return serverError('password',e,'비밀번호를 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.')}
}
