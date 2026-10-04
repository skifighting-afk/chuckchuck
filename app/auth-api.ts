// 로그인·가입·비밀번호는 Supabase Auth가 맡는다. 이 파일은
// 1) 요청의 Supabase 토큰을 확인해 기존 코드가 쓰던 oai-authenticated-user-* 헤더로 바꿔 주고
// 2) 화면의 /api/auth 요청(가입·로그인·비밀번호 찾기·이메일 확인)을 Supabase Auth로 중계한다.
import {digest,randomToken,validPassword} from '../lib/password';
import {mailReady,sendMail} from '../lib/mail';
export type AuthEnv={DB:D1Database,SUPABASE_URL?:string,SUPABASE_ANON_KEY?:string,SUPABASE_SERVICE_ROLE_KEY?:string,RESEND_API_KEY?:string,EMAIL_FROM?:string,AUTH_FETCH?:typeof fetch};
type Env=AuthEnv;
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const goodEmail=(v:unknown)=>typeof v==='string'&&v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const bearer=(r:Request)=>{const m=/^Bearer\s+(.+)$/i.exec(r.headers.get('authorization')||'');return m?m[1].trim():'';};

/** Supabase Auth(GoTrue) 호출. admin=true면 service role 키를 쓴다. */
async function gotrue(env:Env,path:string,init:{method?:string,body?:any,token?:string,admin?:boolean}={}){
 if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY)throw Error('SUPABASE_URL/SUPABASE_ANON_KEY 설정이 필요해요.');
 const key=init.admin?env.SUPABASE_SERVICE_ROLE_KEY:env.SUPABASE_ANON_KEY;
 if(!key)throw Error('SUPABASE_SERVICE_ROLE_KEY 설정이 필요해요.');
 const response=await (env.AUTH_FETCH||fetch)(env.SUPABASE_URL.replace(/\/$/,'')+'/auth/v1'+path,{method:init.method||'GET',headers:{apikey:key,Authorization:'Bearer '+(init.token||key),'Content-Type':'application/json'},body:init.body===undefined?undefined:JSON.stringify(init.body),signal:AbortSignal.timeout(12000)});
 const data:any=await response.json().catch(()=>({}));
 return {ok:response.ok,status:response.status,data};
}
const session=(d:any)=>d?.access_token?{access_token:d.access_token,refresh_token:d.refresh_token,expires_at:d.expires_at||Math.floor(Date.now()/1000)+(Number(d.expires_in)||3600)}:null;

export async function authLimit(env:Env,key:string,max:number,window:number){
 const now=Date.now(),bucket=await digest(key+':'+Math.floor(now/window));
 const row=await env.DB.prepare('INSERT INTO auth_limits(bucket,hits,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=auth_limits.hits+1 RETURNING hits').bind(bucket,now+window*2).first<any>();
 return row.hits<=max;
}

/** Supabase 사용자에 대응하는 앱 계정(이름·역할·이메일 확인 여부). 없으면 가입 정보로 만든다. */
async function appUser(env:Env,user:any){
 const found=await env.DB.prepare('SELECT * FROM app_users WHERE auth_id=?').bind(user.id).first<any>();
 if(found)return found;
 const meta=user.user_metadata||{},role=meta.role==='employee'?'employee':'owner',name=String(meta.name||user.email||'').slice(0,80)||'사용자';
 await env.DB.prepare('INSERT OR IGNORE INTO app_users(id,auth_id,email,name,role,email_verified,created_at) VALUES(?,?,?,?,?,0,?)').bind('native:'+user.id,user.id,String(user.email).toLowerCase(),name,role,Date.now()).run();
 return env.DB.prepare('SELECT * FROM app_users WHERE auth_id=?').bind(user.id).first<any>();
}

/** 요청의 Supabase 토큰을 확인해 신원 헤더를 붙인다. 브라우저가 보낸 신원 헤더는 항상 지운다. */
export async function withNativeIdentity(request:Request,env:Env){
 const headers=new Headers(request.headers);
 for(const name of [...headers.keys()])if(name.startsWith('oai-authenticated-user-'))headers.delete(name);
 const token=bearer(request);
 if(token&&token!==env.SUPABASE_ANON_KEY&&token.length<4096){
  const r=await gotrue(env,'/user',{token}).catch(()=>null);
  const user=r?.ok&&r.data?.id&&r.data?.email?await appUser(env,r.data):null;
  if(user){headers.set('oai-authenticated-user-id',user.id);headers.set('oai-authenticated-user-email',user.email);headers.set('oai-authenticated-user-full-name',encodeURIComponent(user.name));headers.set('oai-authenticated-user-full-name-encoding','percent-encoded-utf-8');headers.set('oai-authenticated-user-native-role',user.role);headers.set('oai-authenticated-user-email-verified',String(!!user.email_verified));}
 }
 return new Request(request,{headers});
}

export async function nativeAuth(request:Request,env:Env){
 if(request.method==='GET'){
  const r=await withNativeIdentity(request,env),id=r.headers.get('oai-authenticated-user-id');
  return json({authenticated:!!id,email:id?r.headers.get('oai-authenticated-user-email'):null,verified:!!id&&r.headers.get('oai-authenticated-user-email-verified')==='true',mailReady:mailReady(env),native:!!id});
 }
 if(request.method!=='POST'||request.headers.get('origin')!==new URL(request.url).origin)return json({error:'이 화면에서 다시 시도해 주세요.'},403);
 try{
  const raw=await request.text();if(raw.length>5000)return json({error:'입력 내용이 너무 깁니다.'},413);
  let b:any;try{b=JSON.parse(raw)}catch{return json({error:'입력 내용을 확인해 주세요.'},400)}if(!b||typeof b!=='object')return json({error:'입력 내용을 확인해 주세요.'},400);const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
  if(b.action==='logout'||b.action==='legacy'){
   const token=bearer(request);if(token&&token!==env.SUPABASE_ANON_KEY)await gotrue(env,'/logout',{method:'POST',token}).catch(()=>null);
   return json({ok:true,session:null});
  }
  const ip=(request.headers.get('x-forwarded-for')||'').split(',')[0].trim()||request.headers.get('cf-connecting-ip')||'local';
  await env.DB.prepare('DELETE FROM auth_limits WHERE expires_at<?').bind(Date.now()).run();
  if(!await authLimit(env,'ip:'+ip,60,15*60000))return json({error:'시도가 많아요. 15분 뒤 다시 시도해 주세요.'},429);
  if(b.action==='verifyEmail'){
   if(typeof b.token!=='string'||!/^([a-f0-9]{64})$/.test(b.token))return json({error:'인증 주소를 다시 확인해 주세요.'},400);
   const proof=await env.DB.prepare('DELETE FROM auth_verifications WHERE token_hash=? AND expires_at>? RETURNING user_id,email').bind(await digest(b.token),Date.now()).first<any>();
   if(!proof)return json({error:'만료되었거나 사용한 인증 주소예요. 새 인증메일을 받아 주세요.'},400);
   const changed=await env.DB.prepare('UPDATE app_users SET email_verified=1 WHERE id=? AND email=?').bind(proof.user_id,proof.email).run();
   if(!changed.meta.changes)return json({error:'계정 정보가 바뀌었어요. 다시 인증해 주세요.'},409);
   await env.DB.prepare('DELETE FROM auth_verifications WHERE user_id=?').bind(proof.user_id).run();
   return json({ok:true,message:'이메일 확인을 마쳤어요.'});
  }
  if(b.action==='sendVerification'){
   const current=await withNativeIdentity(new Request(request.url,{headers:request.headers}),env),id=current.headers.get('oai-authenticated-user-id');
   if(!id)return json({error:'로그인한 뒤 이메일을 확인해 주세요.'},401);
   const user=await env.DB.prepare('SELECT id,email,email_verified FROM app_users WHERE id=?').bind(id).first<any>();
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
   // b.token은 비밀번호 재설정 메일 링크로 받은 Supabase 접근 토큰이다.
   if(!validPassword(b.password)||typeof b.token!=='string'||b.token.length<20||b.token.length>4096)return json({error:'비밀번호는 8~128자로 입력해 주세요. 단순 반복이나 연속 숫자는 피해 주세요.'},400);
   const changed=await gotrue(env,'/user',{method:'PUT',token:b.token,body:{password:b.password}});
   if(!changed.ok||!changed.data?.id)return json({error:'만료되었거나 사용한 주소예요. 비밀번호 찾기를 다시 해 주세요.'},400);
   const user=await appUser(env,changed.data);
   // 메일 링크로 들어왔으니 이메일 주인임이 확인됐다.
   if(user&&String(changed.data.email).toLowerCase()===user.email)await env.DB.prepare('UPDATE app_users SET email_verified=1 WHERE id=?').bind(user.id).run();
   await gotrue(env,'/logout?scope=others',{method:'POST',token:b.token}).catch(()=>null);
   return json({ok:true});
  }
  if(!goodEmail(email))return json({error:'이메일 주소를 확인해 주세요.'},400);
  if(!await authLimit(env,'email:'+email,10,15*60000))return json({error:'시도가 많아요. 15분 뒤 다시 시도해 주세요.'},429);
  if(b.action==='recover'){
   const sent=await gotrue(env,'/recover?redirect_to='+encodeURIComponent(new URL('/login?mode=reset',request.url).href),{method:'POST',body:{email}});
   if(!sent.ok&&sent.status>=500)return json({error:'비밀번호 찾기 이메일 연결을 준비 중이에요. 지금은 비밀번호를 안전한 곳에 보관해 주세요.',code:'EMAIL_NOT_READY'},503);
   return json({ok:true,message:'가입한 이메일이라면 비밀번호 설정 주소를 보내드렸어요.'});
  }
  if(b.action==='register'){
   if(!validPassword(b.password))return json({error:'비밀번호는 8~128자로 입력해 주세요. 단순 반복이나 연속 숫자는 피해 주세요.'},400);
   if(!['owner','employee'].includes(b.role)||typeof b.name!=='string'||!b.name.trim()||b.name.length>80)return json({error:'이름과 가입할 역할을 확인해 주세요.'},400);
   if(await env.DB.prepare('SELECT 1 AS x FROM app_users WHERE email=?').bind(email).first())return json({error:'이 이메일로 가입할 수 없어요. 기존 회원이라면 로그인해 주세요.'},409);
   // 가입 즉시 쓸 수 있게 만든다. 이메일 확인은 앱의 '이메일 확인' 단계에서 따로 한다.
   const created=await gotrue(env,'/admin/users',{method:'POST',admin:true,body:{email,password:b.password,email_confirm:true,user_metadata:{name:b.name.trim(),role:b.role}}});
   if(!created.ok||!created.data?.id)return created.status===422?json({error:'이 이메일로 가입할 수 없어요. 기존 회원이라면 로그인해 주세요.'},409):json({error:'가입을 완료하지 못했어요. 잠시 뒤 다시 시도해 주세요.'},502);
   await appUser(env,created.data);
   const login=await gotrue(env,'/token?grant_type=password',{method:'POST',body:{email,password:b.password}});
   if(!login.ok)return json({error:'가입은 됐어요. 로그인해 주세요.'},409);
   return json({ok:true,role:b.role,emailVerified:false,session:session(login.data)});
  }
  if(b.action==='login'){
   if(typeof b.password!=='string'||b.password.length>128)return json({error:'이메일 또는 비밀번호를 확인해 주세요.'},401);
   const login=await gotrue(env,'/token?grant_type=password',{method:'POST',body:{email,password:b.password}});
   if(!login.ok||!login.data?.user)return json({error:'이메일 또는 비밀번호를 확인해 주세요.'},401);
   const user=await appUser(env,login.data.user);
   return json({ok:true,role:user.role,emailVerified:!!user.email_verified,session:session(login.data)});
  }
  return json({error:'지원하지 않는 요청입니다.'},400);
 }catch{return json({error:'계정 처리를 완료하지 못했어요. 잠시 뒤 다시 시도해 주세요.'},500)}
}

/** 서명 직전 본인 확인: 현재 비밀번호를 다시 확인하고, 이메일 확인 여부를 사실대로 기록한다. */
export async function confirmSigner(request:Request,env:Env,password:unknown,requireVerified=true){
 const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');
 if(!id||!email)throw Error('로그인한 계정으로 서명해 주세요.');
 if(!await authLimit(env,'signer:'+id,10,15*60000))throw Error('시도가 많아요. 15분 뒤 다시 서명해 주세요.');
 const user=await env.DB.prepare('SELECT * FROM app_users WHERE id=?').bind(id).first<any>();
 if(!user)throw Error('로그인 계정을 확인해 주세요.');
 if(requireVerified&&!user.email_verified)throw Error('계약서 사본을 이메일로 받으려면 먼저 내 이메일을 확인해 주세요.');
 if(typeof password!=='string'||!password||password.length>128)throw Error('현재 비밀번호를 확인해 주세요.');
 const check=await gotrue(env,'/token?grant_type=password',{method:'POST',body:{email:user.email,password}});
 if(!check.ok||check.data?.user?.id!==user.auth_id)throw Error('현재 비밀번호를 확인해 주세요.');
 return {userId:id,email:user.email,authMethod:'email-password',emailVerified:!!user.email_verified};
}
