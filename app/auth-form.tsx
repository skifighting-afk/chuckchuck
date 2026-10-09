import {useRef,useState} from 'react';
import {ArrowRight,Eye,EyeOff} from 'lucide-react';
import {kakaoLoginEnabled,kakaoLoginUrl} from './api-client';
import {MfaPrompt} from './totp-ui';
export function AuthForm({role,next,account,admin=false}:{role:'owner'|'employee',next:string,account:any,admin?:boolean}){
 const employee=role==='employee',query=new URLSearchParams(location.search),reset=query.get('reset')||(query.get('mode')==='reset'?(new URLSearchParams(location.hash.slice(1)).get('access_token')||new URLSearchParams(location.hash.slice(1)).get('token')):null);
 const [mode,setMode]=useState<'login'|'register'|'recover'|'reset'>(reset?'reset':location.pathname==='/signup'||location.pathname==='/employee'||query.get('mode')==='signup'?'register':'login');
 const [email,setEmail]=useState(''),[name,setName]=useState(''),[password,setPassword]=useState(''),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[other,setOther]=useState(false),[agree,setAgree]=useState(false);const lock=useRef(false);
 const [mfa,setMfa]=useState<string>('');
 const change=(value:typeof mode)=>{setMode(value);setError('');setMessage('');setPassword('')};
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(lock.current)return;setError('');setMessage('');
  lock.current=true;setBusy(true);
  try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:mode==='register'?'register':mode,email,name,password,role,token:reset,agree})});const d:any=await r.json();if(!r.ok)throw Error(d.error);
   if(mode==='recover'){setMessage(d.message);return}if(mode==='reset'){history.replaceState(null,'','/login?role='+role);change('login');setMessage('비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.');return}
   if(d.mfaRequired){setMfa(d.role||'owner');return}
   const destination=admin?'/admin':next.startsWith('/app?')?next:d.role==='employee'?'/employee'+(query.get('code')?'?code='+encodeURIComponent(query.get('code')!):''):next.startsWith('/signup')?next:'/app';location.assign(destination);
  }catch(e){setError(e instanceof Error?e.message:'연결을 확인한 뒤 다시 시도해 주세요.')}finally{lock.current=false;setBusy(false)}
 };
 const destination=next.startsWith('/app?')?next:account?.onboarded?'/app':employee?'/employee'+(query.get('code')?'?code='+encodeURIComponent(query.get('code')!):''):'/signup?plan=free';
 if(mfa)return <MfaPrompt onDone={()=>location.assign(admin?'/admin':next.startsWith('/app?')?next:mfa==='employee'?'/employee':'/app')}/>;
 return <section className="auth-card native-auth"><img src="/cheokcheoki-welcome.png" width="76" height="76" alt="반갑게 인사하는 척척이"/><span className="saas-kicker">{admin?'본사 관리자':employee?'직원':'사장님'}</span><h1>{mode==='recover'?'비밀번호를 잊으셨나요?':mode==='reset'?'새 비밀번호를 정해 주세요':mode==='register'?(employee?'직원으로 가입해요':'사장님으로 가입해요'):admin?'관리자 로그인':'다시 오셨네요'}</h1><p>{admin?'본사 관리에 연결한 이메일로 로그인하세요.':employee?'내 정보와 근로조건을 확인하고, 사장님께 신청해요.':'우리 가게의 직원과 근무를 한곳에서 관리해요.'}</p>
 {account&&!other&&!reset?<><div className="notice"><b>{account.user.email}</b><p>{account.onboarded?'이미 로그인되어 있어요.':'계정 준비가 끝났어요. 다음 단계로 가세요.'}</p></div><a className="saas-primary" href={destination}>{account.onboarded?'내 화면 열기':employee?'직원 정보 입력하기':'내 가게 만들기'} <ArrowRight size={18}/></a><button className="saas-secondary" onClick={()=>setOther(true)}>다른 이메일로 로그인</button></>:<>
 {!admin&&!reset&&mode!=='recover'&&<div className="auth-mode" role="group" aria-label="로그인 또는 회원가입"><button aria-pressed={mode==='login'} onClick={()=>change('login')}>로그인</button><button aria-pressed={mode==='register'} onClick={()=>change('register')}>회원가입</button></div>}
 {mode==='recover'?<ForgotPassword employee={employee}/>:<form onSubmit={submit}>
 {mode==='register'&&<label className="saas-field">{employee?'직원 이름':'사장님 성함'}<input autoComplete="name" required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="실명을 입력해 주세요"/></label>}
 {mode!=='reset'&&<label className="saas-field">이메일<input type="email" autoComplete="username" inputMode="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="예: hello@example.com"/></label>}
 {<><label className="saas-field">비밀번호<div className="password-field"><input aria-label="비밀번호" type={visible?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='login'?1:8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} aria-describedby={mode==='login'?undefined:'password-guide'}/><button type="button" aria-label={visible?'비밀번호 숨기기':'비밀번호 보기'} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={20}/>:<Eye size={20}/>}<span>{visible?'숨기기':'보기'}</span></button></div></label>{mode!=='login'&&<><small id="password-guide">8자 이상이면 돼요. 특수문자는 필수가 아니에요. 이름·생일처럼 쉬운 조합은 피해 주세요.</small></>}</>}
 {mode==='register'&&<label className="auth-agree"><input type="checkbox" required checked={agree} onChange={e=>setAgree(e.target.checked)}/><span>만 14세 이상이고, <a href="/terms" target="_blank" rel="noopener">이용약관</a>과 <a href="/privacy" target="_blank" rel="noopener">개인정보 처리방침</a>을 읽고 동의해요. (필수)</span></label>}
 {error&&<p className="saas-error" role="alert">{error}</p>}{message&&<p className="saas-success" role="status">{message}</p>}
 <button className="saas-primary" disabled={busy} type="submit">{busy?'잠시만 기다려 주세요…':mode==='register'?'계정 만들고 다음으로':mode==='reset'?'새 비밀번호 저장':'로그인'}</button>
 </form>}{kakaoLoginEnabled&&!admin&&(mode==='login'||mode==='register')&&<a className="kakao-login" href={kakaoLoginUrl(employee?'/staff-join':'/app')}>카카오로 {mode==='register'?'시작하기':'로그인'}</a>}{mode==='login'?<button className="auth-text-button" onClick={()=>change('recover')}>비밀번호를 잊었어요</button>:mode==='recover'&&<button className="auth-text-button" onClick={()=>change('login')}>← 로그인으로 돌아가기</button>}
 </>}
 {!admin&&<><a href={mode==='register'?(employee?'/signup?role=owner&plan=free':'/employee'):'/login?role='+(employee?'owner':'employee')}>{employee?'사장님 화면으로':'직원 화면으로'}</a><a href="/demo">가입 없이 먼저 체험하기 →</a></>}{admin&&<a href="/admin">← 관리자 화면으로</a>}
 </section>;
}

/** 메일 없이 비밀번호 찾기: 직원은 사장님께, 사장님은 본사에 요청 */
function ForgotPassword({employee}:{employee:boolean}){
 const [f,setF]=useState({email:'',name:'',phone:'',store:''}),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[err,setErr]=useState('');
 if(employee)return <div className="notice"><b>사장님께 비밀번호 초기화를 요청해 주세요</b><p>사장님이 직원 관리 화면의 내 카드에서 '비밀번호 초기화'를 누르면 임시 비밀번호가 나와요. 그걸로 로그인한 뒤 새 비밀번호를 정하면 돼요.</p></div>;
 const send=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setErr('');try{const r=await fetch('/api/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'request',...f})});const d:any=await r.json();if(!r.ok)throw Error(d.error);setMsg(d.message)}catch(e){setErr((e as Error).message||'요청하지 못했어요. 잠시 뒤 다시 시도해 주세요.')}finally{setBusy(false)}};
 const field=(k:keyof typeof f,label:string,props:any={})=><label className="saas-field">{label}<input required={k!=='store'} value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})} {...props}/></label>;
 return msg?<p className="saas-success" role="status">{msg}</p>:<form onSubmit={send}><p className="auth-note">본사가 적어 주신 번호로 연락해 본인인지 확인한 뒤 임시 비밀번호를 알려 드려요. 임시 비밀번호로 로그인하면 바로 새 비밀번호를 정해요.</p>
  {field('email','가입한 이메일',{type:'email',inputMode:'email',maxLength:254})}{field('name','사장님 성함',{maxLength:40})}{field('phone','연락받을 전화번호',{inputMode:'tel',maxLength:20,placeholder:'010-0000-0000'})}{field('store','가게 이름 (본인 확인용, 선택)',{maxLength:80})}
  {err&&<p className="saas-error" role="alert">{err}</p>}<button className="saas-primary" disabled={busy} type="submit">{busy?'보내는 중…':'비밀번호 찾기 요청'}</button></form>;
}
/** 임시 비밀번호로 로그인한 사람: 새 비밀번호를 정하기 전에는 다른 화면을 못 씀 */
export function ChangePasswordGate({onDone}:{onDone:()=>void}){
 const [a,setA]=useState(''),[b,setB]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const save=async(e:React.FormEvent)=>{e.preventDefault();if(a!==b){setErr('두 칸에 같은 비밀번호를 넣어 주세요.');return}setBusy(true);setErr('');try{const r=await fetch('/api/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'change',password:a})});const d:any=await r.json();if(!r.ok)throw Error(d.error);onDone()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}};
 return <main className="auth-card" style={{maxWidth:520,margin:'40px auto'}}><h1>새 비밀번호를 정해 주세요</h1><p>임시 비밀번호로 로그인했어요. 나만 아는 새 비밀번호로 바꾸면 계속 쓸 수 있어요.</p><form onSubmit={save}>
  <label className="saas-field">새 비밀번호<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={a} onChange={e=>setA(e.target.value)}/></label>
  <label className="saas-field">한 번 더<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={b} onChange={e=>setB(e.target.value)}/></label>
  <small>8자 이상, 같은 글자 반복이나 12345678 같은 쉬운 조합은 안 돼요.</small>
  {err&&<p className="saas-error" role="alert">{err}</p>}<button className="saas-primary" disabled={busy} type="submit">{busy?'저장하고 있어요…':'새 비밀번호 저장'}</button></form><a href="/logout">로그아웃</a></main>;
}
