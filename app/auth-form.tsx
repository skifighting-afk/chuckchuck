import {useRef,useState} from 'react';
import {ArrowRight,Eye,EyeOff} from 'lucide-react';
export function AuthForm({role,next,account,admin=false}:{role:'owner'|'employee',next:string,account:any,admin?:boolean}){
 const employee=role==='employee',query=new URLSearchParams(location.search),reset=query.get('reset')||(query.get('mode')==='reset'?(new URLSearchParams(location.hash.slice(1)).get('access_token')||new URLSearchParams(location.hash.slice(1)).get('token')):null);
 const [mode,setMode]=useState<'login'|'register'|'recover'|'reset'>(reset?'reset':location.pathname==='/signup'||location.pathname==='/employee'||query.get('mode')==='signup'?'register':'login');
 const [email,setEmail]=useState(''),[name,setName]=useState(''),[password,setPassword]=useState(''),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[other,setOther]=useState(false),[agree,setAgree]=useState(false);const lock=useRef(false);
 const change=(value:typeof mode)=>{setMode(value);setError('');setMessage('');setPassword('')};
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(lock.current)return;setError('');setMessage('');
  lock.current=true;setBusy(true);
  try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:mode==='register'?'register':mode,email,name,password,role,token:reset,agree})});const d:any=await r.json();if(!r.ok)throw Error(d.error);
   if(mode==='recover'){setMessage(d.message);return}if(mode==='reset'){history.replaceState(null,'','/login?role='+role);change('login');setMessage('비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.');return}
   const destination=admin?'/admin':next.startsWith('/app?')?next:d.role==='employee'?'/employee'+(query.get('code')?'?code='+encodeURIComponent(query.get('code')!):''):next.startsWith('/signup')?next:'/app';location.assign(destination);
  }catch(e){setError(e instanceof Error?e.message:'연결을 확인한 뒤 다시 시도해 주세요.')}finally{lock.current=false;setBusy(false)}
 };
 const destination=next.startsWith('/app?')?next:account?.onboarded?'/app':employee?'/employee'+(query.get('code')?'?code='+encodeURIComponent(query.get('code')!):''):'/signup?plan=free';
 return <section className="auth-card native-auth"><img src="/cheokcheoki-welcome.png" width="76" height="76" alt="반갑게 인사하는 척척이"/><span className="saas-kicker">{admin?'본사 관리자':employee?'직원':'사장님'}</span><h1>{mode==='recover'?'비밀번호를 잊으셨나요?':mode==='reset'?'새 비밀번호를 정해 주세요':mode==='register'?(employee?'직원으로 가입해요':'사장님으로 가입해요'):admin?'관리자 로그인':'다시 오셨네요'}</h1><p>{admin?'본사 관리에 연결한 이메일로 로그인하세요.':employee?'내 정보와 근로조건을 확인하고, 사장님께 신청해요.':'우리 가게의 직원과 근무를 한곳에서 관리해요.'}</p>
 {account&&!other&&!reset?<><div className="notice"><b>{account.user.email}</b><p>{account.onboarded?'이미 로그인되어 있어요.':'계정 준비가 끝났어요. 다음 단계로 가세요.'}</p></div><a className="saas-primary" href={destination}>{account.onboarded?'내 화면 열기':employee?'직원 정보 입력하기':'내 가게 만들기'} <ArrowRight size={18}/></a><button className="saas-secondary" onClick={()=>setOther(true)}>다른 이메일로 로그인</button></>:<>
 {!admin&&!reset&&mode!=='recover'&&<div className="auth-mode" role="group" aria-label="로그인 또는 회원가입"><button aria-pressed={mode==='login'} onClick={()=>change('login')}>로그인</button><button aria-pressed={mode==='register'} onClick={()=>change('register')}>회원가입</button></div>}
 <form onSubmit={submit}>
 {mode==='register'&&<label className="saas-field">{employee?'직원 이름':'사장님 성함'}<input autoComplete="name" required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="실명을 입력해 주세요"/></label>}
 {mode!=='reset'&&<label className="saas-field">이메일<input type="email" autoComplete="username" inputMode="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="예: hello@example.com"/></label>}
 {mode!=='recover'&&<><label className="saas-field">비밀번호<div className="password-field"><input aria-label="비밀번호" type={visible?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='login'?1:8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} aria-describedby={mode==='login'?undefined:'password-guide'}/><button type="button" aria-label={visible?'비밀번호 숨기기':'비밀번호 보기'} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={20}/>:<Eye size={20}/>}<span>{visible?'숨기기':'보기'}</span></button></div></label>{mode!=='login'&&<><small id="password-guide">8자 이상이면 돼요. 특수문자는 필수가 아니에요. 이름·생일처럼 쉬운 조합은 피해 주세요.</small></>}</>}
 {mode==='register'&&<label className="auth-agree"><input type="checkbox" required checked={agree} onChange={e=>setAgree(e.target.checked)}/><span>만 14세 이상이고, <a href="/terms" target="_blank" rel="noopener">이용약관</a>과 <a href="/privacy" target="_blank" rel="noopener">개인정보 처리방침</a>을 읽고 동의해요. (필수)</span></label>}
 {error&&<p className="saas-error" role="alert">{error}</p>}{message&&<p className="saas-success" role="status">{message}</p>}
 <button className="saas-primary" disabled={busy} type="submit">{busy?'잠시만 기다려 주세요…':mode==='register'?'계정 만들고 다음으로':mode==='recover'?'비밀번호 설정 주소 받기':mode==='reset'?'새 비밀번호 저장':'로그인'}</button>
 </form>{mode==='login'?<button className="auth-text-button" onClick={()=>change('recover')}>비밀번호를 잊었어요</button>:mode==='recover'&&<button className="auth-text-button" onClick={()=>change('login')}>← 로그인으로 돌아가기</button>}
 </>}
 {!admin&&<><a href={mode==='register'?(employee?'/signup?role=owner&plan=free':'/employee'):'/login?role='+(employee?'owner':'employee')}>{employee?'사장님 화면으로':'직원 화면으로'}</a><a href="/demo">가입 없이 먼저 체험하기 →</a></>}{admin&&<a href="/admin">← 관리자 화면으로</a>}
 </section>;
}
