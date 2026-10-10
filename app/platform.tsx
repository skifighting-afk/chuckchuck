import {DeviceSessions} from './devices';
import {PushToggle} from './push';
import {CachedShifts} from './improve2-staff';
import {isNativeApp} from './native';
import {TextSizeToggle,applyTextSize,ThemeToggle,applyTheme} from './text-size';
applyTextSize();applyTheme();
import {InstallButton,registerSW} from './install';
import {TransferOwner,TransferOffers} from './transfer';
import {OperatorFooter} from './operator-footer';
import {Landing,TryFirst} from './public-pages';
import {IncidentBanner} from './incident-banner';
import {trackSignupThen} from './meta-pixel';
import {StoreSwitcher,CoownerAccept,CoownerPanel} from './coowner';
import {BizStatus,CancelSubscription,RefundPolicy,PaymentHistory,ServiceNotices,TrialBanner,PlanChangeQuote,RefundEstimate,TaxInvoice,Checkout,BillingResult} from './billing';
registerSW();
import {VerifyEmail} from './verify-email';
import {AuthForm,ChangePasswordGate} from './auth-form';
import {attendanceQrEntry} from '../lib/qr-entry';
import {industries,isIndustry} from '../lib/industries';
'use client';
import {useEffect,useState,lazy,Suspense,type ReactNode} from 'react';
// 작업 010: 처음 화면에 필요 없는 큰 화면은 필요할 때 불러온다
const ContractsDesk=lazy(()=>import('./contracts-desk').then(x=>({default:x.ContractsDesk})));
const AdminDesk=lazy(()=>import('./admin-desk').then(x=>({default:x.AdminDesk})));
const ClientErrors=lazy(()=>import('./admin-desk').then(x=>({default:x.ClientErrors})));
const RefundDesk=lazy(()=>import('./admin-desk').then(x=>({default:x.RefundDesk})));
const ManagerDesk=lazy(()=>import('./manager-desk').then(x=>({default:x.ManagerDesk})));
const StaffJoin=lazy(()=>import('./staff-join').then(x=>({default:x.StaffJoin})));
const Calculator=lazy(()=>import('./calculator').then(x=>({default:x.Calculator})));
const Help=lazy(()=>import('./help').then(x=>({default:x.Help})));
const LiveQr=lazy(()=>import('./live-qr').then(x=>({default:x.LiveQr})));
const Withdraw=lazy(()=>import('./withdraw').then(x=>({default:x.Withdraw})));
const TeamApp=lazy(()=>import('./team'));
const HrWorkspace=lazy(()=>import('./hr/workspace').then(x=>({default:x.HrWorkspace})));
// 가이드 93: 약관·요금·상태 화면은 열 때만 불러온다
const LegalPage=lazy(()=>import('./legal-page').then(x=>({default:x.LegalPage})));
const PricingPage=lazy(()=>import('./public-pages').then(x=>({default:x.PricingPage})));
const StatusPage=lazy(()=>import('./status-page').then(x=>({default:x.StatusPage})));
const Support=lazy(()=>import('./support').then(x=>({default:x.Support})));
const SharePage=lazy(()=>import('./accountant-share').then(x=>({default:x.SharePage})));
const LaunchPages=()=>import('./launch-pages');
const PrivacyRequest=lazy(()=>LaunchPages().then(x=>({default:x.PrivacyRequest})));
const NewsPage=lazy(()=>LaunchPages().then(x=>({default:x.NewsPage})));
const MarketingToggle=lazy(()=>LaunchPages().then(x=>({default:x.MarketingToggle})));
const TotpPanel=lazy(()=>import('./totp-ui').then(x=>({default:x.TotpPanel})));
const MfaPrompt=lazy(()=>import('./totp-ui').then(x=>({default:x.MfaPrompt})));
const KioskPage=lazy(()=>import('./kiosk').then(x=>({default:x.KioskPage})));
const SupportDesk=lazy(()=>import('./support').then(x=>({default:x.SupportDesk})));
const PasswordDesk=lazy(()=>import('./support').then(x=>({default:x.PasswordDesk})));

import {ArrowRight,Check,Store,ShieldCheck,ArrowLeft,LogOut,CreditCard,Clock3,Users} from 'lucide-react';
import {plans,planId,money,monthlyPrice,periodPrice,TRIAL_DAYS,type PlanId} from '../lib/plans';
import {PricingPicker} from './pricing';
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogHeader} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Checkbox} from '@/components/ui/checkbox';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';
declare const __HOME_ORIGIN__:string;
const HOME_ORIGIN=typeof __HOME_ORIGIN__==='string'?__HOME_ORIGIN__.replace(/\/$/,''):'';
const signIn=(path:string)=>'/signin-with-chatgpt?return_to='+encodeURIComponent(path.startsWith('/')&&!path.startsWith('//')?path:'/app');
const signOut='/signout-with-chatgpt?return_to=%2Flogin';
export default function Platform(){
 const [account,setAccount]=useState<any>(null),[status,setStatus]=useState('loading'),[error,setError]=useState('');
 const path=isNativeApp()&&['/','/pricing','/start','/signup'].includes(location.pathname)?(location.pathname==='/signup'?'/signup':'/app'):location.pathname,query=new URLSearchParams(location.search),invite=query.get('invite'),qrEntry=attendanceQrEntry(path,location.search);
 const reload=async()=>{setError('');setStatus('loading');try{const r=await fetch('/api/account');const d:any=await r.json();if(r.status===401){setStatus(d.code==='MFA_REQUIRED'?'mfa':'anonymous');return}if(!r.ok)throw Error(d.error);setAccount(d);setStatus('ready')}catch(e){setError(e instanceof Error?e.message:'연결할 수 없습니다.');setStatus('error')}};
 useEffect(()=>{if(!['/demo','/try','/start','/calculator','/help','/refund','/admin','/admin/login','/kiosk','/policy','/accessibility','/news','/privacy-request'].includes(path))reload()},[]);
 if(path==='/admin/login')return <Shell><main className="native-auth-wrap"><AuthForm role="owner" next="/admin" account={null} admin/></main></Shell>;
 if(path==='/admin')return <Shell><AdminDesk/><SupportDesk/><PasswordDesk/><RefundDesk/><ClientErrors/><section className="saas-account" aria-label="본사 알림"><p className="saas-fine">서버 오류가 10분 안에 3번 넘게 나면 이 기기로 알림을 보내요.</p><PushToggle/></section></Shell>;
 if(path==='/verify-email')return <Shell><VerifyEmail/></Shell>;
 if(path==='/withdraw')return <Shell><DeviceSessions/><TotpPanel/><MarketingToggle/><PushToggle/><Withdraw/></Shell>;
 if(path==='/calculator')return <Shell><Calculator/></Shell>;
 if(path==='/help')return <Shell><Help/></Shell>;
 if(path==='/refund')return <Shell><RefundPolicy/></Shell>;
 if(path==='/billing/success'||path==='/billing/fail')return <Shell><BillingResult ok={path==='/billing/success'}/></Shell>;
 if(path==='/pricing')return <Shell><PricingPage/></Shell>;
 if(path==='/status')return <Shell><StatusPage/></Shell>;
 if(path==='/share')return <Shell><SharePage/></Shell>;
 if(path==='/kiosk')return <KioskPage/>;
 if(path==='/logout')return <Logout/>;
 if(path==='/start')return <Start/>;
 if(path==='/demo'||path==='/try')return query.get('screen')==='hr'?<HrWorkspace demo/>:<TeamApp demo/>;
 if(path==='/terms'||path==='/privacy')return <Shell><LegalPage privacy={path==='/privacy'}/></Shell>;
 if(path==='/privacy-request')return <Shell><PrivacyRequest/></Shell>;
 if(path==='/news')return <Shell><NewsPage/></Shell>;
 if(path==='/policy'||path==='/accessibility')return <Shell><LegalPage doc={path==='/policy'?'policy':'accessibility'}/></Shell>;
 if(status==='loading')return <Shell><div className="auth-card"><Clock3 className="auth-icon"/><h1>척척사장을 준비하고 있어요.</h1><p>계정과 매장 연결을 확인합니다.</p></div></Shell>;
 if(status==='error')return <Shell><div className="auth-card"><h1>잠시 연결이 어렵습니다.</h1><p role="alert">{error}</p><Button onClick={reload}>다시 연결</Button><CachedShifts/><a href="/login">로그인 화면</a><a href="/contracts">내 서류 보기</a><a href="/withdraw">회원 탈퇴</a></div></Shell>;
 if(status==='mfa')return <Shell><MfaPrompt onDone={()=>location.reload()}/></Shell>;
 // 로그인 안 한 사람의 첫 화면은 브랜드 홈페이지(chukchuksajang.co.kr)로. 광고 꼬리표(utm 등)는 그대로 넘긴다. 내 컴퓨터·테스트에서는 기존 소개 화면.
 if(status==='anonymous'&&path==='/'){if(HOME_ORIGIN&&![...query.keys()].some(k=>!/^(utm_|fbclid$|gclid$)/.test(k))&&!/^(localhost|127\.|\[::1\])/.test(location.hostname)){location.replace(HOME_ORIGIN+location.search);return null}return <Shell><Landing/></Shell>}
 if(status==='anonymous'||path==='/login')return <Login account={account} role={(query.has('reset')||query.get('mode')==='reset')?'owner':qrEntry?'employee':path==='/employee'?'employee':query.get('role')==='employee'?'employee':path==='/signup'?'owner':query.get('role')==='owner'?'owner':undefined} next={qrEntry|| (query.get('role')==='employee'?'/employee':path==='/employee'?'/employee'+location.search:invite?'/?invite='+encodeURIComponent(invite):query.get('next')==='/account'?'/account':path==='/signup'?'/signup?plan='+(planId(query.get('plan'))?query.get('plan'):'free'):'/app')}/>;
 if(account?.mustChangePassword)return <Shell><ChangePasswordGate onDone={reload}/></Shell>;
 if(account?.consentRequired)return <ConsentGate onDone={reload}/>;
 if(path==='/support')return <Shell><Support/></Shell>;
 if(path==='/coowner')return <Shell><CoownerAccept/></Shell>;
 if(path==='/contracts')return <Shell><ContractsDesk/></Shell>;
 if(path==='/manager'&&account.onboarded)return <Shell><ManagerDesk/></Shell>;
 if(path==='/employee')return <Shell><StaffJoin/></Shell>;
 if(path==='/staff-requests'&&account.onboarded)return <Shell><StaffJoin owner/></Shell>;
 if(path==='/qr-screen'&&account.onboarded&&account.access==='owner')return <LiveQr branch={query.get('branch')||'branch-main'} name={query.get('name')||'우리 매장'} onClose={()=>{if(history.length>1)history.back();else location.assign('/app')}}/>;
 if(invite)return <TeamApp/>;
 if(!account.onboarded&&(qrEntry||account.user.role==='employee'))return <Shell><StaffJoin returnTo={qrEntry||"/app"}/></Shell>;
 if(!account.onboarded)return <Onboarding offers={account.transferOffers} onDone={()=>location.assign('/app')} email={account.user.email} initial={planId(query.get('plan'))||'pro'}/>;
 if(path==='/signup'||path==='/account')return <Account data={account} reload={reload}/>;
 if(path==='/hr')return <Shell><HrWorkspace/></Shell>;
 return <><IncidentBanner staff={account.access!=='owner'}/><StoreSwitcher stores={account.stores} current={account.currentStore}/>{account.access==='owner'&&<><ServiceNotices notices={account.serviceNotices}/><TrialBanner account={account.account}/></>}{account.storeClosingAt&&<div className="closing-banner" role="status">{account.access==='owner'?<>탈퇴를 예약해 {new Date(account.storeClosingAt).toLocaleDateString('ko-KR')}에 가게 데이터가 삭제돼요. 지금은 읽기 전용이에요. <a href="/withdraw">예약 취소</a></>:<>이 가게는 {new Date(account.storeClosingAt).toLocaleDateString('ko-KR')}에 서비스에서 삭제될 예정이에요. 그 전에 <a href="/contracts">내 근로계약서와 임금명세서</a>를 내려받아 두세요.</>}</div>}<div className="account-strip"><a href="/account"><Store size={15}/>{account.storeName}<span>{account.access==='owner'?'계정·요금제':'내 계정'}</span></a>{account.hq&&<a href="/admin">본사 관리</a>}<span>{account.access==='employee'?'직원 계정':account.access==='manager'?'매니저 계정':account.account?.status==='active'?'이용 중':account.account?.status==='trialing'?`무료 체험 · ${Math.max(0,Math.ceil((+new Date(account.account.trialEndsAt)-Date.now())/86400000))}일 남음`:account.account?.status==='expired'||account.account?.status==='cancelled'?'체험 종료 · 조회 가능':'사전 운영'}</span><a href="/help">도움말</a><InstallButton/><TextSizeToggle/><ThemeToggle/><a href={account.user.authMethod==='email'?'/logout':signOut} target="_top"><LogOut size={14}/>로그아웃</a></div><TeamApp/></>;
}
function ConsentGate({onDone}:{onDone:()=>Promise<void>}){
 // 작업 016: 약관·처리방침이 바뀌었거나 동의 기록이 없는 계정은 다시 동의해야 계속 쓸 수 있다.
 const [agree,setAgree]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const submit=async()=>{if(busy||!agree)return;setBusy(true);setError('');try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'consent',agree:true})});const d:any=await r.json();if(!r.ok)throw Error(d.error);await onDone()}catch(e){setError(e instanceof Error?e.message:'동의를 저장하지 못했어요.')}finally{setBusy(false)}};
 return <Shell><main className="auth-card"><h1>안내 내용이 바뀌었어요</h1><p>계속 이용하려면 바뀐 이용약관과 개인정보 처리방침을 확인해 주세요.</p><label className="saas-check"><Checkbox checked={agree} onCheckedChange={v=>setAgree(v===true)} aria-label="이용약관과 개인정보 처리방침 동의"/><span><a href="/terms" target="_blank" rel="noopener">이용약관</a>과 <a href="/privacy" target="_blank" rel="noopener">개인정보 처리방침</a>을 읽고 동의해요.</span></label>{error&&<p role="alert" className="saas-error">{error}</p>}<Button className="saas-primary" disabled={busy||!agree} onClick={submit}>{busy?'저장하고 있어요…':'동의하고 계속하기'}</Button><a href="/logout">로그아웃</a></main></Shell>}
function Shell({children}:{children:ReactNode}){return <div className="saas-shell"><header className="saas-nav"><a className="saas-brand" href="/start"><span><Store size={22}/></span>척척사장<small>매장 일을 척척</small></a><a href="/app">내 매장 <ArrowRight size={16}/></a></header>{children}<footer className="saas-footer"><span>함께 일하는 사람을 위한 매장 관리</span><a href="/calculator">주휴수당 계산기</a><a href="/pricing">요금</a><a href="/status">서비스 상태</a><a href="/support">문의하기</a><a href="/news">서비스 소식</a><a href="/refund">해지·환불</a><a href="/terms">이용약관</a><a href="/policy">운영정책</a><a href="/privacy"><b>개인정보 처리방침</b></a><a href="/privacy-request">개인정보 요청</a><a href="/accessibility">접근성</a><OperatorFooter/></footer></div>}
function Login({account,next,role}:{account:any,next:string,role?:'owner'|'employee'}){
 if(!role)return <Shell><main className="auth-card" style={{maxWidth:600,margin:'40px auto'}}><h1>어떤 일을 하시나요?</h1><p>내 역할을 고르면 바로 시작할 수 있어요.</p><a className="saas-primary" href="/login?role=owner">사장님으로 시작</a><a className="saas-secondary" href="/login?role=employee">직원으로 시작</a><a href="/demo">가입 없이 먼저 체험하기</a></main></Shell>;
 return <Shell><main className="native-auth-wrap"><AuthForm role={role} next={next} account={account}/></main></Shell>;
}
function Onboarding({email,initial,onDone,offers}:{email:string,initial:PlanId,onDone:()=>void,offers?:any[]}){
 const [step,setStep]=useState(1),[plan,setPlan]=useState<PlanId>(initial),[name,setName]=useState(''),[owner,setOwner]=useState(''),[industry,setIndustry]=useState(''),[bizNo,setBizNo]=useState(''),[branches,setBranches]=useState(1),[months,setMonths]=useState<1|6|12>(1),[ack,setAck]=useState(false),[dpa,setDpa]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();if(step===1){if(!isIndustry(industry)){setError('업종을 하나 골라 주세요.');return}setError('');setStep(2);return}if(busy)return;setBusy(true);setError('');try{const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'onboard',storeName:name,branchName:name,ownerName:owner,industry,plan,storeSlots:branches,months,acknowledged:ack,dpaAgreed:dpa,bizNo:bizNo.replace(/\D/g,'')||undefined})});const d:any=await r.json();if(!r.ok)throw Error(d.error);trackSignupThen(plan,onDone)}catch(e){setError(e instanceof Error?e.message:'가게를 만들지 못했어요.')}finally{setBusy(false)}}
 return <Shell><main className="easy-setup"><div className="easy-setup-heading"><img src="/cheokcheoki-welcome.png" width="110" height="110" alt="함께 시작하는 척척이"/><div><p>{step} / 2 단계</p><h1>{step===1?'가게 이름부터 알려주세요.':`${TRIAL_DAYS}일 무료로 시작해요.`}</h1><p>{step===1?'어려운 설정은 나중에 해도 돼요.':'카드 번호를 입력하지 않아요. 체험이 끝나도 자동 결제되지 않아요.'}</p></div></div><TransferOffers offers={offers}/><form className="auth-card" onSubmit={submit}>{step===1?<><div className="saas-field"><Label htmlFor="store-name">가게 이름</Label><Input id="store-name" autoFocus required maxLength={80} placeholder="예: 행복한 김밥" value={name} onChange={e=>setName(e.target.value)}/></div><div className="saas-field"><Label htmlFor="owner-name">사장님 성함</Label><Input id="owner-name" required maxLength={80} placeholder="성함을 입력해 주세요" value={owner} onChange={e=>setOwner(e.target.value)}/></div><div className="saas-field"><Label htmlFor="biz-no">사업자등록번호 (선택)</Label><Input id="biz-no" inputMode="numeric" maxLength={12} placeholder="000-00-00000 · 나중에 넣어도 돼요" value={bizNo} onChange={e=>setBizNo(e.target.value)}/><small>국세청에 계속사업자인지 확인해요. 확인이 안 돼도 가게는 바로 만들어져요.</small></div><fieldset className="industry-picker"><legend>어떤 가게를 운영하시나요?</legend><p>가장 가까운 업종을 하나 골라 주세요.</p><div>{industries.map(i=><label key={i.id} className={industry===i.id?'selected':''}><input type="radio" name="industry" value={i.id} checked={industry===i.id} onChange={()=>{setIndustry(i.id);setError('')}} required/><span aria-hidden="true">{i.icon}</span><b>{i.name}</b><Check size={18} aria-hidden="true"/></label>)}</div></fieldset><Button type="submit" className="saas-primary">다음으로 →</Button></>:<><div className="simple-instruction"><b>{name}</b><p>체험이 끝난 뒤 쓸 요금제를 골라 두세요. 언제든 바꿀 수 있어요.</p></div><PricingPicker plan={plan} setPlan={setPlan} branches={branches} setBranches={setBranches} months={months} setMonths={setMonths} idPrefix="setup"/><label className="saas-check"><Checkbox checked={ack} onCheckedChange={v=>setAck(v===true)}/><span><a href="/terms" target="_blank" rel="noopener">이용 준비 안내</a>를 확인했어요. 지금은 판매 준비 중이라 결제되지 않아요.</span></label><label className="saas-check"><Checkbox checked={dpa} onCheckedChange={v=>setDpa(v===true)} aria-label="직원 개인정보 처리위탁 동의"/><span>직원 개인정보(이름·연락처·근무·급여 기록)는 사장님이 관리 책임자이고, 척척사장은 사장님을 대신해 저장·처리만 합니다. <a href="/privacy#processing" target="_blank" rel="noopener">처리위탁 내용</a>을 확인하고 동의해요.</span></label><Button type="submit" className="saas-primary" disabled={busy||!ack||!dpa}>{busy?'가게를 만들고 있어요…':`${TRIAL_DAYS}일 무료 체험 시작`}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setStep(1)}>← 가게 이름 다시 입력</Button></>}{error&&<p role="alert" className="saas-error">{error}</p>}<small>연결된 계정: {email}</small></form></main></Shell>
}
function Account({data,reload}:{data:any,reload:()=>Promise<void>}){
 if(isNativeApp()&&data.onboarded)return <NativeAccount data={data}/>;
 const a=data.account;
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[plan,setPlan]=useState<PlanId>(a?.plan||'pro'),[branches,setBranches]=useState<number>(a?.storeSlots||1),[months,setMonths]=useState<1|6|12>(a?.months||1);
 const dirty=a&&(plan!==a.plan||branches!==a.storeSlots||months!==a.months);
 const change=async()=>{if(busy)return;setBusy(true);setError('');setMessage('');try{const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'changePlan',plan,storeSlots:branches,months})});const d:any=await r.json();if(!r.ok)throw Error(d.error);await reload();setMessage('요금제를 바꿨어요. 지금은 결제되지 않아요.')}catch(e){setError(e instanceof Error?e.message:'바꾸지 못했어요.')}finally{setBusy(false)}};
 const statusName=(s:string)=>({trialing:`${TRIAL_DAYS}일 무료 체험 중`,active:'이용 중',expired:'체험 종료 · 조회와 내려받기만 가능',cancelled:'체험 중단 · 조회와 내려받기만 가능',legacy:'기존 매장 이용 중'} as any)[s]||s;
 return <Shell><main className="saas-account"><a className="saas-back" href="/app"><ArrowLeft size={16}/> 우리 매장으로</a><h1>요금제</h1>{data.hq&&<p><a href="/admin">본사 관리자 화면 →</a></p>}<p>{data.storeName} · {data.user.email}</p>{data.user.authMethod==='email'&&<div className="notice">이메일 {data.user.emailVerified?'확인 완료':<a href="/verify-email">확인하기 →</a>} · <a href="/contracts">전자계약서와 사본 열기</a></div>}{data.access!=='owner'?<div className="auth-card">요금제는 사장님이 관리해요.</div>:<><div className="account-grid"><section className="auth-card"><span className="saas-status">{statusName(a.status)}</span><h2>{a.planName||'기존 매장'}</h2><p>{a.trialEndsAt&&a.status==='trialing'?'체험 종료 '+new Date(a.trialEndsAt).toLocaleDateString('ko-KR'):'카드 등록 · 자동 결제 없음'}</p><div className="usage-line"><span>등록 지점</span><b>{data.usage.branches} / {a.storeSlots}곳</b></div><div className="usage-line"><span>직원</span><b>{data.usage.employees}명 · 제한 없음</b></div><div className="usage-line"><span>이번 달 전자계약서(건당 {money(a.contracts.extraPrice)}원)</span><b>체결 {a.contracts.thisMonth}건{a.contracts.free?` (무료 ${a.contracts.free}건)`:''} · 청구 예정 {money(a.contracts.extra*a.contracts.extraPrice)}원</b></div><div className="usage-line"><span>QR 출퇴근</span><b>{a.qr?'사용 중':'프로에서 사용'}</b></div><a href="/app?screen=stores">매장 관리·비교 열기 →</a></section><section className="auth-card"><CreditCard/><h2>이번 청구 금액 0원</h2><p>결제 서비스를 연결하기 전이라 청구되지 않아요. 정식 판매 후에도 사장님이 직접 동의할 때만 결제돼요.</p><div className="usage-line"><span>선택한 요금</span><b>월 {money(a.monthlyPrice)}원</b></div>{a.months>1&&<div className="usage-line"><span>{a.months}개월 구독</span><b>{money(a.periodPrice)}원</b></div>}<RefundEstimate a={a}/><small>VAT 포함 · 자동 갱신 꺼짐</small></section></div><Checkout a={a}/><h2 className="t-gap">요금제 바꾸기</h2><PricingPicker plan={plan} setPlan={setPlan} branches={branches} setBranches={setBranches} months={months} setMonths={setMonths} idPrefix="account"/>{dirty&&<PlanChangeQuote a={a} plan={plan} branches={branches} months={months}/>}<Button className="saas-primary" disabled={busy||!dirty||a.status==='legacy'} onClick={change}>{busy?'바꾸고 있어요…':dirty?'이 요금으로 바꾸기':'지금 쓰는 요금이에요'}</Button><p className="saas-fine">체험은 가게당 한 번 {TRIAL_DAYS}일이에요. 요금제나 지점 수를 바꿔도 체험 종료일은 늘어나지 않아요. 체험이 끝나면 기록 조회와 내려받기는 계속되고, 저장은 결제를 연결한 뒤 다시 할 수 있어요. 데이터를 임의로 지우지 않아요.</p><PaymentHistory payments={data.payments}/><CancelSubscription a={a} reload={reload}/><BizStatus a={a} reload={reload}/><TaxInvoice a={a} reload={reload}/><TransferOwner a={a} storeName={data.storeName} reload={reload}/><CoownerPanel data={data} reload={reload}/></>}{message&&<p role="status" className="saas-success">{message}</p>}{error&&<p role="alert" className="saas-error">{error}</p>}<p className="saas-fine"><a href="/withdraw">회원 탈퇴</a></p></main></Shell>
}

function Start(){return <Shell><main className="saas-account" style={{maxWidth:900}}><h1>어떤 일을 하시나요?</h1><p>내 역할을 고르면 필요한 화면으로 안내해 드려요.</p><div className="account-grid role-grid"><section className="auth-card role-card"><Store aria-hidden="true"/><h2>사장님</h2><p>우리 가게 직원과 근무표, 급여를 관리해요.</p><a className="saas-primary" href="/signup?role=owner&plan=free">사장님으로 무료 시작</a><a className="saas-secondary" href="/login?role=owner">사장님 로그인</a></section><section className="auth-card role-card"><Users aria-hidden="true"/><h2>직원</h2><p>일하는 가게에 합류하고 내 출퇴근과 급여를 확인해요.</p><a className="saas-primary" href="/employee">직원으로 가입하기</a><a className="saas-secondary" href="/login?role=employee">직원 로그인</a></section></div><TryFirst/><small>앱 설치 없이 · 사장님 가입에 초대 불필요 · 직원은 사장님 수락 후 연결</small></main></Shell>}

function Logout(){const [error,setError]=useState('');useEffect(()=>{fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout',everywhere:new URLSearchParams(location.search).get('everywhere')==='1'})}).then(r=>{if(!r.ok)throw Error();location.replace(new URLSearchParams(location.search).get('next')==='/admin/login'?'/admin/login':'/login')}).catch(()=>setError('로그아웃하지 못했어요. 연결을 확인하고 다시 시도해 주세요.'))},[]);return <Shell><main className="auth-card"><h1>{error||'로그아웃하고 있어요'}</h1>{error&&<button onClick={()=>location.reload()}>다시 시도</button>}</main></Shell>}

/** 스토어 앱 안의 계정 화면: 이용 상태만 보여 주고 결제·요금 변경은 넣지 않는다(앱 심사 규정) */
function NativeAccount({data}:{data:any}){
 const a=data.account||{};
 return <Shell><main className="saas-account"><a className="saas-back" href="/app">← 우리 매장으로</a><h1>내 계정</h1>
  <section className="auth-card"><h2>{data.storeName||'우리 가게'}</h2><div className="usage-line"><span>이용 상태</span><b>{({trialing:'무료 체험 중',active:'이용 중',grace:'이용 중',expired:'기간 끝남 · 조회만',cancelled:'해지됨 · 조회만',legacy:'이용 중'} as any)[a.state||a.status]||'이용 중'}</b></div>{a.trialEndsAt&&a.status==='trialing'&&<div className="usage-line"><span>체험 끝나는 날</span><b>{String(a.trialEndsAt).slice(0,10)}</b></div>}{a.paidUntil&&<div className="usage-line"><span>이용 기간</span><b>{String(a.paidUntil).slice(0,10)}까지</b></div>}<div className="usage-line"><span>등록 지점</span><b>{a.storeSlots||1}곳</b></div></section>
  <section className="auth-card t-gap"><h2>계정 관리</h2><p><a href="/withdraw">로그인 기기·2단계 인증·알림·회원 탈퇴 →</a></p><p><a href="/support">문의하기 →</a></p><p><a href="/terms">이용약관</a> · <a href="/privacy">개인정보 처리방침</a></p><p><a href="/logout">로그아웃</a></p></section>
 </main></Shell>;
}
