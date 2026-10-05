// 가이드 20·21: 로그인 없이 보는 소개(/)와 요금 안내(/pricing). 숫자는 lib/plans.ts에서 가져온다.
import {useState} from 'react';
import {CalendarDays,ClipboardCheck,FileText,QrCode,Wallet,Users} from 'lucide-react';
import {PricingPicker} from './pricing';
import {plans,monthlyPrice,money,TRIAL_DAYS,CONTRACTS_FREE_PER_MONTH,CONTRACT_EXTRA_PRICE,type PlanId} from '../lib/plans';

const ROWS:[string,string,string][]=[
 ['직원 수','제한 없음','제한 없음'],
 ['근무표 · 대타·교대 요청','포함','포함'],
 ['출퇴근 기록 · 정정 승인','앱 버튼으로 기록','앱 버튼 + 매장 QR'],
 ['매장 QR 출퇴근 (30초마다 바뀌는 QR)','—','포함'],
 ['급여 계산 · 임금명세서 · 임금대장','포함','포함'],
 ['전자근로계약서',`월 ${CONTRACTS_FREE_PER_MONTH}장 무료 · 추가 ${money(CONTRACT_EXTRA_PRICE)}원`,`월 ${CONTRACTS_FREE_PER_MONTH}장 무료 · 추가 ${money(CONTRACT_EXTRA_PRICE)}원`],
 ['휴가 · 공지 · 매장 매뉴얼','포함','포함'],
];

export function PricingPage(){
 const [plan,setPlan]=useState<PlanId>('pro'),[branches,setBranches]=useState(1),[months,setMonths]=useState<1|6|12>(1);
 return <main className="saas-policy public-page">
  <span className="saas-kicker">요금 안내</span>
  <h1>지점 수로만 정해요</h1>
  <p>베이직과 프로 두 가지예요. 직원이 몇 명이든 요금은 같고, 모든 금액은 VAT 포함이에요. 가입 후 {TRIAL_DAYS}일은 카드 등록 없이 무료예요.</p>
  <div className="legal-table" role="region" aria-label="요금제 비교" tabIndex={0}><table><thead><tr><th scope="col">기능</th><th scope="col">{plans.basic.name}</th><th scope="col">{plans.pro.name}</th></tr></thead><tbody>
   {ROWS.map(([k,b,p])=><tr key={k}><th scope="row">{k}</th><td>{b}</td><td>{p}</td></tr>)}
   {([['1지점',1],['2~3지점',3],['4~5지점',5]] as [string,number][]).map(([k,n])=><tr key={k} className="price-row"><th scope="row">월 요금 · {k}</th><td>{money(monthlyPrice('basic',n))}원</td><td>{money(monthlyPrice('pro',n))}원</td></tr>)}
  </tbody></table></div>
  <p className="saas-fine">6지점부터 지점당 월 {money(plans.pro.extraPerBranch)}원이 더해져요. 6개월 구독은 10%, 12개월 구독은 20% 할인돼요.</p>
  <h2>내 가게 요금 계산</h2>
  <PricingPicker plan={plan} setPlan={setPlan} branches={branches} setBranches={setBranches} months={months} setMonths={setMonths} idPrefix="public"/>
  <a className="saas-primary t-gap" href={`/signup?role=owner&plan=${plan}`}>{TRIAL_DAYS}일 무료로 시작하기</a>
  <p className="saas-fine">해지·환불 기준은 <a href="/refund">해지·환불 규정</a>, 계약 조건은 <a href="/terms">이용약관</a>에 있어요.</p>
 </main>;
}

const FEATURES:[typeof Users,string,string][]=[
 [Users,'직원 등록은 링크 하나로','가입 링크를 보내면 직원이 스스로 정보를 넣고, 사장님은 수락만 해요. 엑셀 표를 붙여 넣어 여러 명을 한 번에 등록할 수도 있어요.'],
 [CalendarDays,'근무표는 지난주 복사로','반복 등록·지난주 복사·템플릿으로 짜고, 직원끼리 대타를 구하면 사장님은 승인만 해요.'],
 [QrCode,'출퇴근은 매장 QR로','매장 QR을 찍어야 출퇴근이 기록돼요. 30초마다 바뀌는 QR을 켜 두면 사진으로 찍어 두고 다른 곳에서 찍을 수 없어요. 위치는 기록하지 않아요.'],
 [Wallet,'급여는 근거와 함께','주휴수당·5명 이상 가산·4대보험·소득세를 계산하고, 줄마다 계산 근거를 보여 줘요. 확정하면 직원 앱으로 명세서가 가요.'],
 [FileText,'근로계약서는 표준서식으로','고용노동부 표준 근로계약서 양식으로 만들고 사장님·직원이 휴대폰에서 서명해요.'],
 [ClipboardCheck,'월말 마감은 체크리스트로','퇴근 누락, 최저시급 미달, 서명 안 된 계약서를 마감 전에 한 화면에서 보여 줘요.'],
];

export function Landing(){
 return <main className="landing">
  <section className="landing-hero">
   <span className="saas-kicker">작은 가게 사장님을 위한 매장 관리</span>
   <h1>직원 출근부터 월급 정리까지, 척척.</h1>
   <p>앱 설치 없이 휴대폰으로 열어요. 오늘 누가 일하는지, 이번 달 급여가 얼마인지 한곳에서 확인해요.</p>
   <div className="landing-cta"><a className="saas-primary" href="/signup?role=owner">{TRIAL_DAYS}일 무료로 시작하기</a><a className="saas-secondary" href="/demo">가입 없이 화면 먼저 보기</a></div>
   <small>카드 등록 없음 · 자동 결제 없음 · 직원은 <a href="/employee">여기서 가입</a></small>
  </section>
  <section className="landing-features" aria-label="주요 기능">{FEATURES.map(([Icon,t,d])=><article key={t}><Icon aria-hidden="true"/><h2>{t}</h2><p>{d}</p></article>)}</section>
  <section className="landing-price"><h2>요금은 지점 수로만</h2><p>베이직 월 {money(monthlyPrice('basic',1))}원부터, 매장 QR 출퇴근이 들어간 프로 월 {money(monthlyPrice('pro',1))}원부터(1지점, VAT 포함). 직원 수 제한은 없어요.</p><a className="saas-secondary" href="/pricing">요금 자세히 보기 →</a></section>
  <section className="landing-tools"><h2>가입 전에 써 볼 수 있어요</h2><div><a className="saas-secondary" href="/calculator">주휴수당·인건비 계산기 →</a><a className="saas-secondary" href="/help">자주 묻는 질문 →</a><a className="saas-secondary" href="/start">사장님·직원 로그인 →</a></div></section>
 </main>;
}
