import {digest,randomToken,passwordHash,equalHash,validPassword} from '../lib/password';
import {mailReady,sendMail} from '../lib/mail';
type Env={DB:D1Database,RESEND_API_KEY?:string,EMAIL_FROM?:string};
const DAY=86400000;
const json=(data:any,status=200,cookie?:string)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})}});
const cookieName=(r:Request)=>new URL(r.url).protocol==='https:'?'__Host-cheok_session':'cheok_session';
const readCookie=(r:Request)=>(r.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName(r)+'='))?.slice(cookieName(r).length+1);
const cookie=(r:Request,value:string)=>`${cookieName(r)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${new URL(r.url).protocol==='https:'?'; Secure':''}`;
const goodEmail=(v:unknown)=>typeof v==='string'&&v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export async function authLimit(env:Env,key:string,max:number,window:number){
 const now=Date.now(),bucket=await digest(key+':'+Math.floor(now/window));
 const row=await env.DB.prepare('INSERT INTO auth_limits(bucket,hits,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=auth_limits.hits+1 RETURNING hits').bind(bucket,now+window*2).first<any>();
 return row.hits<=max;
}
async function session(request:Request,env:Env,user:any){
 const token=randomToken(),old=readCookie(request);
 if(old)await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await digest(old)).run();
 await env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at<?').bind(Date.now()).run();
 // A password reset racing with login must not leave a session for the old password.
 const inserted=await env.DB.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) SELECT ?,id,? FROM auth_users WHERE id=? AND password_hash=?').bind(await digest(token),Date.now()+7*DAY,user.id,user.password_hash).run();
 if(!inserted.meta.changes)return json({error:'계정 정보가 바뀌었어요. 다시 로그인해 주세요.'},401);
 return json({ok:true,role:user.role,emailVerified:!!user.email_verified},200,cookie(request,token));
}
export async function withNativeIdentity(request:Request,env:Env){
 const token=readCookie(request);if(token===undefined)return request;
 const headers=new Headers(request.headers);
 for(const name of [...headers.keys()])if(name.startsWith('oai-authenticated-user-'))headers.delete(name);
 if(/^[a-f0-9]{64}$/.test(token)){
  const user=await env.DB.prepare('SELECT u.id,u.email,u.name,u.role,u.email_verified FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),Date.now()).first<any>();
  if(user){headers.set('oai-authenticated-user-id',user.id);headers.set('oai-authenticated-user-email',user.email);headers.set('oai-authenticated-user-full-name',encodeURIComponent(user.name));headers.set('oai-authenticated-user-full-name-encoding','percent-encoded-utf-8');headers.set('oai-authenticated-user-native-role',user.role);headers.set('oai-authenticated-user-email-verified',String(!!user.email_verified));}
 }
 return new Request(request,{headers});
}
export async function nativeAuth(request:Request,env:Env){
 if(request.method==='GET'){
  const r=await withNativeIdentity(request,env),id=r.headers.get('oai-authenticated-user-id');
  return json({authenticated:!!id,email:id?r.headers.get('oai-authenticated-user-email'):null,verified:!!id&&(!id.startsWith('native:')||r.headers.get('oai-authenticated-user-email-verified')==='true'),mailReady:mailReady(env),native:!!id?.startsWith('native:')});
 }
 if(request.method!=='POST'||request.headers.get('origin')!==new URL(request.url).origin)return json({error:'이 화면에서 다시 시도해 주세요.'},403);
 try{
  const raw=await request.text();if(raw.length>5000)return json({error:'입력 내용이 너무 깁니다.'},413);
  let b:any;try{b=JSON.parse(raw)}catch{return json({error:'입력 내용을 확인해 주세요.'},400)}if(!b||typeof b!=='object')return json({error:'입력 내용을 확인해 주세요.'},400);const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
  if(b.action==='logout'||b.action==='legacy'){
   const token=readCookie(request);if(token)await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await digest(token)).run();
   return json({ok:true},200,b.action==='legacy'?cookie(request,'').replace('Max-Age=604800','Max-Age=0'):cookie(request,'signed-out'));
  }
  const ip=request.headers.get('cf-connecting-ip')||'local';
  await env.DB.prepare('DELETE FROM auth_limits WHERE expires_at<?').bind(Date.now()).run();
  await env.DB.prepare('DELETE FROM auth_recovery WHERE expires_at<?').bind(Date.now()).run();
  if(!await authLimit(env,'ip:'+ip,60,15*60000))return json({error:'시도가 많아요. 15분 뒤 다시 시도해 주세요.'},429);
  if(b.action==='verifyEmail'){
   if(typeof b.token!=='string'||!/^([a-f0-9]{64})$/.test(b.token))return json({error:'인증 주소를 다시 확인해 주세요.'},400);
   const proof=await env.DB.prepare('DELETE FROM auth_verifications WHERE token_hash=? AND expires_at>? RETURNING user_id,email').bind(await digest(b.token),Date.now()).first<any>();
   if(!proof)return json({error:'만료되었거나 사용한 인증 주소예요. 새 인증메일을 받아 주세요.'},400);
   const changed=await env.DB.prepare('UPDATE auth_users SET email_verified=1 WHERE id=? AND email=?').bind(proof.user_id,proof.email).run();
   if(!changed.meta.changes)return json({error:'계정 정보가 바뀌었어요. 다시 인증해 주세요.'},409);
   await env.DB.prepare('DELETE FROM auth_verifications WHERE user_id=?').bind(proof.user_id).run();
   return json({ok:true,message:'이메일 확인을 마쳤어요. 이제 계약서에 서명할 수 있어요.'});
  }
  if(b.action==='sendVerification'){
   const current=await withNativeIdentity(new Request(request.url,{headers:request.headers}),env),id=current.headers.get('oai-authenticated-user-id');
   if(!id)return json({error:'로그인한 뒤 이메일을 확인해 주세요.'},401);
   if(!id.startsWith('native:'))return json({ok:true,verified:true});
   const user=await env.DB.prepare('SELECT id,email,email_verified FROM auth_users WHERE id=?').bind(id).first<any>();
   if(!user)return json({error:'다시 로그인해 주세요.'},401);
   if(user.email_verified)return json({ok:true,verified:true});
   if(!mailReady(env))return json({error:'발신 도메인과 이메일 발송 연결을 준비 중이에요.',code:'EMAIL_NOT_READY'},503);
   if(!await authLimit(env,'verify-minute:'+id,1,60000)||!await authLimit(env,'verify-hour:'+id,5,3600000))return json({error:'메일함을 확인해 주세요. 다시 받기는 1분 뒤, 한 시간에 최대 5번 가능해요.'},429);
   const token=randomToken(),hash=await digest(token);
   await env.DB.prepare('INSERT INTO auth_verifications(token_hash,user_id,email,expires_at,created_at) VALUES(?,?,?,?,?)').bind(hash,id,user.email,Date.now()+30*60000,Date.now()).run();
   try{await sendMail(env,{to:user.email,subject:'척척사장봇 · 이메일을 확인해 주세요',text:'본인이 만든 척척사장봇 계정이라면 아래 주소에서 이메일 확인을 눌러 주세요. 30분 동안 사용할 수 있어요. 요청하지 않았다면 누르지 않아도 됩니다.\n\n'+new URL('/verify-email#token='+token,request.url).href,key:'verify-'+hash});}
   catch{await env.DB.prepare('DELETE FROM auth_verifications WHERE token_hash=?').bind(hash).run();return json({error:'인증메일을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.'},503)}
   await env.DB.prepare('DELETE FROM auth_verifications WHERE user_id=? AND token_hash<>?').bind(id,hash).run();
   return json({ok:true,message:'인증메일을 보냈어요. 메일함과 스팸함을 확인해 주세요.'});
  }
  if(b.action==='reset'){
   if(!validPassword(b.password)||typeof b.token!=='string'||!/^([a-f0-9]{64})$/.test(b.token))return json({error:'비밀번호는 8~128자로 입력해 주세요. 단순 반복이나 연속 숫자는 피해 주세요.'},400);
   const recovery=await env.DB.prepare('DELETE FROM auth_recovery WHERE token_hash=? AND expires_at>? RETURNING user_id').bind(await digest(b.token),Date.now()).first<any>();
   if(!recovery)return json({error:'만료되었거나 사용한 주소예요. 비밀번호 찾기를 다시 해 주세요.'},400);
   const salt=randomToken(),hash=await passwordHash(b.password,salt);
   await env.DB.prepare('UPDATE auth_users SET password_hash=?,salt=?,email_verified=1 WHERE id=?').bind(hash,salt,recovery.user_id).run();
   await env.DB.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(recovery.user_id).run();
   await env.DB.prepare('DELETE FROM auth_recovery WHERE user_id=?').bind(recovery.user_id).run();
   return json({ok:true});
  }
  if(!goodEmail(email))return json({error:'이메일 주소를 확인해 주세요.'},400);
  if(!await authLimit(env,'email:'+email,10,15*60000))return json({error:'시도가 많아요. 15분 뒤 다시 시도해 주세요.'},429);
  const user=await env.DB.prepare('SELECT * FROM auth_users WHERE email=?').bind(email).first<any>();
  if(b.action==='recover'){
   if(!env.RESEND_API_KEY||!env.EMAIL_FROM)return json({error:'비밀번호 찾기 이메일 연결을 준비 중이에요. 지금은 비밀번호를 안전한 곳에 보관해 주세요.',code:'EMAIL_NOT_READY'},503);
   if(user){
    const token=randomToken();await env.DB.prepare('DELETE FROM auth_recovery WHERE user_id=?').bind(user.id).run();
    await env.DB.prepare('INSERT INTO auth_recovery(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),user.id,Date.now()+3600000).run();
    const url=new URL('/login?mode=reset#token='+token,request.url).href;
    try{await sendMail(env,{to:email,subject:'척척사장봇 비밀번호 다시 설정',text:'한 시간 안에 아래 주소에서 새 비밀번호를 설정해 주세요. 요청하지 않았다면 무시하셔도 됩니다.\n'+url,key:'recover-'+await digest(token)});}
    catch{await env.DB.prepare('DELETE FROM auth_recovery WHERE token_hash=?').bind(await digest(token)).run();return json({error:'이메일을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.'},503)}
   }
   return json({ok:true,message:'가입한 이메일이라면 비밀번호 설정 주소를 보내드렸어요.'});
  }
  if(b.action==='register'){
   if(!validPassword(b.password))return json({error:'비밀번호는 8~128자로 입력해 주세요. 단순 반복이나 연속 숫자는 피해 주세요.'},400);
   if(!['owner','employee'].includes(b.role)||typeof b.name!=='string'||!b.name.trim()||b.name.length>80)return json({error:'이름과 가입할 역할을 확인해 주세요.'},400);
   if(user)return json({error:'이 이메일로 가입할 수 없어요. 기존 회원이라면 로그인해 주세요.'},409);
   const id='native:'+crypto.randomUUID(),salt=randomToken(),hash=await passwordHash(b.password,salt);
   const result=await env.DB.prepare('INSERT OR IGNORE INTO auth_users(id,email,name,password_hash,salt,role,email_verified,created_at) VALUES(?,?,?,?,?,?,0,?)').bind(id,email,b.name.trim(),hash,salt,b.role,Date.now()).run();
   if(!result.meta.changes)return json({error:'가입 상태가 바뀌었어요. 로그인해 주세요.'},409);
   return session(request,env,{id,role:b.role,email_verified:0,password_hash:hash});
  }
  if(b.action==='login'){
   if(typeof b.password!=='string'||b.password.length>128)return json({error:'이메일 또는 비밀번호를 확인해 주세요.'},401);
   const hash=await passwordHash(b.password,user?.salt||'unregistered-account-dummy-salt');
   if(!user||!equalHash(hash,user.password_hash))return json({error:'이메일 또는 비밀번호를 확인해 주세요.'},401);
   return session(request,env,user);
  }
  return json({error:'지원하지 않는 요청입니다.'},400);
 }catch{return json({error:'계정 처리를 완료하지 못했어요. 잠시 뒤 다시 시도해 주세요.'},500)}
}

export async function confirmSigner(request:Request,env:Env,password:unknown,requireVerified=true){
 const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');
 if(!id||!email)throw Error('로그인한 계정으로 서명해 주세요.');
 if(id.startsWith('native:')){
  if(!await authLimit(env,'signer:'+id,10,15*60000))throw Error('시도가 많아요. 15분 뒤 다시 서명해 주세요.');
  const user=await env.DB.prepare('SELECT * FROM auth_users WHERE id=?').bind(id).first<any>();
  if(!user)throw Error('로그인 계정을 확인해 주세요.');
  if(requireVerified&&!user.email_verified)throw Error('계약서 서명 전에 내 이메일을 확인해 주세요.');
  if(typeof password!=='string'||password.length>128||!equalHash(await passwordHash(password,user.salt),user.password_hash))throw Error('현재 비밀번호를 확인해 주세요.');
 }
 return {userId:id,email,authMethod:id.startsWith('native:')?'email-password':'platform-account',emailVerified:!id.startsWith('native:')||request.headers.get('oai-authenticated-user-email-verified')==='true'};
}
