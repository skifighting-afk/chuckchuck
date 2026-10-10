// 가이드 20·21: 로그인 없이 보는 소개(/)와 요금 안내(/pricing). 숫자는 lib/plans.ts에서 가져온다.
import {useState} from 'react';
import {CalendarDays,ClipboardCheck,FileText,QrCode,Wallet,Users,Store,Smartphone} from 'lucide-react';
import {PricingPicker} from './pricing';
import {plans,monthlyPrice,money,TRIAL_DAYS,CONTRACTS_FREE_PER_MONTH,CONTRACT_EXTRA_PRICE,contractFeeText,type PlanId} from '../lib/plans';

const ROWS:[string,string,string][]=[
 ['직원 수','제한 없음','제한 없음'],
 ['근무표 · 대타·교대 요청','포함','포함'],
 ['출퇴근 기록 · 정정 승인','앱 버튼으로 기록','앱 버튼 + 매장 QR'],
 ['매장 QR 출퇴근 (30초마다 바뀌는 QR)','—','포함'],
 ['급여 계산 · 임금명세서 · 임금대장','포함','포함'],
 ['전자근로계약서',contractFeeText(),contractFeeText()],
 ['휴가 · 공지 · 매장 매뉴얼','포함','포함'],
];

const PLAN_FEATURES:Record<PlanId,string[]>={
 basic:['직원 수 제한 없음','근무표 · 대타·교대 요청','앱 버튼 출퇴근 · 정정 승인','급여 자동 계산 · 명세서 · 임금대장',`전자근로계약서 ${contractFeeText()}`,'휴가 · 공지 · 매장 매뉴얼','인건비 리포트 · 지점 비교(2지점 이상)'],
 pro:['베이직 기능 전부','매장 QR 찍어야 출퇴근 기록','30초마다 바뀌는 QR(대리 출근 막기)'],
};
/** 첫 화면·요금 안내에 쓰는 요금제 카드 두 장. 금액은 lib/plans.ts 그대로. */
export function PlanCards(){
 return <div className="plan-cards">{(['basic','pro'] as PlanId[]).map(id=>{const p=plans[id],[[,one],[,three],[,five]]=p.tiers;return <article key={id} className={'plan-card'+(id==='pro'?' pro':'')} aria-labelledby={'plan-'+id}>
  <header><h3 id={'plan-'+id}>{p.name}</h3>{id==='pro'&&<span className="plan-flag">매장 QR 출퇴근 포함</span>}</header>
  <p className="plan-price"><small>월</small><b>{money(one)}</b><small>원 · 1지점</small></p>
  <dl className="plan-tiers"><div><dt>2~3지점</dt><dd>월 {money(three)}원</dd></div><div><dt>4~5지점</dt><dd>월 {money(five)}원</dd></div><div><dt>6지점부터</dt><dd>지점당 +{money(p.extraPerBranch)}원</dd></div></dl>
  <ul>{PLAN_FEATURES[id].map(f=><li key={f}>{f}</li>)}</ul>
  <a className={id==='pro'?'saas-primary':'saas-secondary'} href={`/signup?role=owner&plan=${id}`}>{p.name}로 {TRIAL_DAYS}일 무료 시작</a>
 </article>})}</div>;
}
export function TryFirst(){
 return <section className="try-first" aria-labelledby="try-first-title">
  <div><h2 id="try-first-title">가입 없이 먼저 체험하기</h2><p>회원가입도 카드 등록도 없이, 예시 가게로 모든 화면을 눌러 볼 수 있어요. 눌러 본 내용은 저장되지 않아요.</p></div>
  <div className="try-tiles"><a href="/demo"><Store aria-hidden="true"/><b>사장님 화면 체험</b><span>근무표 · 출퇴근 · 급여 확정까지</span></a><a href="/demo?role=employee"><Smartphone aria-hidden="true"/><b>직원 화면 체험</b><span>출근 버튼 · 내 근무표 · 명세서</span></a></div>
  <p className="try-links"><a href="/calculator">주휴수당·인건비 계산기</a><a href="/help">자주 묻는 질문</a></p>
 </section>;
}

export function PricingPage(){
 const [plan,setPlan]=useState<PlanId>('pro'),[branches,setBranches]=useState(1),[months,setMonths]=useState<1|6|12>(1);
 return <main className="saas-policy public-page">
  <span className="saas-kicker">요금 안내</span>
  <h1>지점 수로만 정해요</h1>
  <p>베이직과 프로 두 가지예요. 직원이 몇 명이든 요금은 같고, 모든 금액은 VAT 포함이에요. 가입 후 {TRIAL_DAYS}일은 카드 등록 없이 무료예요.</p>
  <PlanCards/>
  <h2>기능 비교</h2>
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
   <div className="landing-cta"><a className="saas-primary" href="/signup?role=owner">{TRIAL_DAYS}일 무료로 시작하기</a><a className="demo-cta" href="/demo"><b>가입 없이 먼저 체험하기</b><span>예시 가게로 바로 눌러 보기 · 30초</span></a></div>
   <small>카드 등록 없음 · 자동 결제 없음 · 직원은 <a href="/employee">여기서 가입</a></small>
  </section>
  <TryFirst/>
  <section className="landing-plans" aria-labelledby="landing-plans-title"><h2 id="landing-plans-title">요금제</h2><p>두 가지 중 고르세요. 모든 금액은 VAT 포함, 직원이 몇 명이든 같아요. {TRIAL_DAYS}일 무료 체험 동안은 프로 기능을 전부 써요.</p><PlanCards/><p className="saas-fine">6개월 구독 10%, 12개월 구독 20% 할인 · 전자근로계약서 추가 1장 {money(CONTRACT_EXTRA_PRICE)}원 · <a href="/pricing">기능 비교표와 내 가게 요금 계산</a></p></section>
  <section className="landing-features" aria-label="주요 기능">{FEATURES.map(([Icon,t,d])=><article key={t}><Icon aria-hidden="true"/><h2>{t}</h2><p>{d}</p></article>)}</section>
</main>;
}
