// 요금제 (2026-10-05 대표님 결정: 매니지와 같은 구조, 가격은 VAT 포함)
// 베이직·프로 2가지, 지점 수 구간별 월 요금, 6지점부터 지점당 3,900원 추가. 직원 수 제한 없음.
// 30일 무료 체험(카드 등록 없음, 자동 결제 없음, 체험 중에는 프로 기능 전부). 6개월 10%·12개월 20% 할인.
// 전자근로계약서는 월 1장 무료, 추가 1장 3,000원(결제 연결 전에는 사용량만 기록).
export const plans = {
 basic:{id:'basic',name:'베이직',tiers:[[1,9900],[3,14900],[5,18900]] as [number,number][],extraPerBranch:3900,qr:false,description:'근무표 · 급여 자동 계산 · 명세서 · 전자계약 · 대장'},
 pro:{id:'pro',name:'프로',tiers:[[1,14900],[3,19900],[5,23900]] as [number,number][],extraPerBranch:3900,qr:true,description:'베이직 전부 + 매장 QR 출퇴근'},
} as const;
export type PlanId=keyof typeof plans;
export const TRIAL_DAYS=30;
export const MAX_BRANCHES=50;
export const CONTRACTS_FREE_PER_MONTH=1;
export const CONTRACT_EXTRA_PRICE=3000;
export const PERIODS=[{months:1,discount:0},{months:6,discount:0.1},{months:12,discount:0.2}] as const;
export const money=(n:number)=>n.toLocaleString('ko-KR');
// 예전 요금제 이름(무료·사장님5·사장님10·여러매장)으로 저장된 가게: 무료는 베이직, 나머지는 프로로 본다.
const LEGACY:Record<string,PlanId>={free:'basic',starter:'pro',team:'pro',multi:'pro'};
export function planId(v:unknown):PlanId|null{if(typeof v!=='string')return null;if(Object.hasOwn(plans,v))return v as PlanId;return LEGACY[v]||null}
export function isPlan(v:unknown):v is PlanId{return typeof v==='string'&&Object.hasOwn(plans,v)}
export function trialStatus(a:any,now=Date.now()){
 if(!a)return 'legacy';
 if(a.status==='cancelled')return 'cancelled';
 // 작업 018: 해지 예약은 이번 결제 기간 끝(cancelAt)까지 그대로 이용
 // 지시서 143: 정기 결제가 실패해도 바로 잠그지 않고 7일 동안은 그대로 쓰게 한다(그동안 결제 수단을 바꾸라고 안내)
 if(a.status==='past_due'){const f=Date.parse(a.paymentFailedAt||'');return Number.isFinite(f)&&now-f<GRACE_DAYS*86400000?'grace':'expired';}
 if(a.status==='active')return a.cancelAt&&Date.parse(a.cancelAt)<=now?'cancelled':'active';
 // 예전 무료 요금제 가게는 베이직으로 계속 이용(정식 판매 전 가입 고객 보호)
 if(a.status==='free'||a.plan==='free')return 'active';
 return Date.parse(a.trialEndsAt)>now?'trialing':'expired';
}
export const GRACE_DAYS=7;
export function graceLeft(a:any,now=Date.now()){if(a?.status!=='past_due')return null;const f=Date.parse(a.paymentFailedAt||'');return Number.isFinite(f)?Math.max(0,Math.ceil((f+GRACE_DAYS*86400000-now)/86400000)):0}
export function canWrite(a:any){if(a?.deletion)return false;return ['legacy','active','trialing','grace'].includes(trialStatus(a))}
export const branchCount=(a:any)=>Math.max(1,Math.min(MAX_BRANCHES,Math.floor(Number(a?.storeSlots)||1)));
export function planLimits(a:any){
 if(!a||!planId(a.plan))return {employees:100000,branches:MAX_BRANCHES};
 return {employees:100000,branches:branchCount(a)};
}
/** 월 요금(VAT 포함): 지점 수 구간 요금, 6지점부터 지점당 추가 */
export function monthlyPrice(plan:PlanId,branches=1){
 const p=plans[plan],n=Math.max(1,Math.min(MAX_BRANCHES,Math.floor(branches)||1));
 for(const [upTo,price] of p.tiers)if(n<=upTo)return price;
 const [lastUpTo,lastPrice]=p.tiers[p.tiers.length-1];return lastPrice+(n-lastUpTo)*p.extraPerBranch;
}
/** 구독 기간 전체 금액(VAT 포함, 10원 단위 내림) */
export function periodPrice(plan:PlanId,branches:number,months:1|6|12){
 const d=PERIODS.find(x=>x.months===months)?.discount??0;
 return Math.floor(monthlyPrice(plan,branches)*months*(1-d)/10)*10;
}
export function capacityError(state:any,a:any){
 const limits=planLimits(a);
 if(state.branches.length>limits.branches)return `지금 요금은 지점 ${limits.branches}곳 기준이에요. 계정·요금제에서 지점 수를 바꿔 주세요.`;
 return '';
}
/** 기능: QR 출퇴근은 프로(체험 중 포함). 나머지는 베이직부터. 지점 비교는 지점이 2곳 이상일 때. */
export function hasFeature(a:any,feature:'payroll'|'reports'|'leave'|'comparison'|'contracts'|'qr'){
 if(!a)return feature!=='qr';
 if(feature==='qr')return planId(a.plan)==='pro'||trialStatus(a)==='trialing';
 if(feature==='comparison')return branchCount(a)>1;
 return true;
}

// 작업 065: 체험 종료 안내(7일·1일 전). 유료 전환은 사장님이 직접 동의할 때만(자동 결제 없음).
export function trialNotice(a:any,now=Date.now()):{level:'7d'|'1d'|'ended'|null,daysLeft:number}{
 if(!a||trialStatus(a,now)!=='trialing'){return {level:a&&['expired','cancelled'].includes(trialStatus(a,now))?'ended':null,daysLeft:0}}
 const left=Math.ceil((Date.parse(a.trialEndsAt)-now)/86400000);
 return {level:left<=1?'1d':left<=7?'7d':null,daysLeft:Math.max(0,left)};
}
const DAY=86400000;
/** 작업 068: 이용 기간 중 요금제·지점 수를 바꿀 때 남은 기간만큼의 차액(+ 추가 청구 / − 다음 청구에서 차감). 결제 연결 전에는 안내용 추정. */
export function changeQuote(cur:{plan:PlanId,slots:number,months:1|6|12},next:{plan:PlanId,slots:number,months:1|6|12},periodStart:string,now=Date.now()){
 const start=Date.parse(periodStart),endD=new Date(start);endD.setUTCMonth(endD.getUTCMonth()+cur.months);const end=+endD;
 const total=Math.max(1,Math.round((end-start)/DAY)),left=Math.max(0,Math.min(total,Math.ceil((end-now)/DAY)));
 const oldDaily=periodPrice(cur.plan,cur.slots,cur.months)/total,newDaily=periodPrice(next.plan,next.slots,cur.months)/total;
 const diff=Math.round((newDaily-oldDaily)*left/10)*10;
 return {daysLeft:left,totalDays:total,diff,periodEnd:new Date(end).toISOString().slice(0,10)};
}
/** 작업 067: 중도 해지 환불(일할). 낸 금액 − 쓴 날 × (낸 금액 ÷ 이용 기간 일수), 10원 미만 버림. 장기 할인은 쓴 기간에도 그대로 적용. */
export function refundQuote(paid:number,months:1|6|12,periodStart:string,cancelAt=Date.now()){
 const start=Date.parse(periodStart),endD=new Date(start);endD.setUTCMonth(endD.getUTCMonth()+months);
 const total=Math.max(1,Math.round((+endD-start)/DAY)),used=Math.max(0,Math.min(total,Math.ceil((cancelAt-start)/DAY)));
 const refund=Math.max(0,Math.floor((paid-paid*used/total)/10)*10);
 return {usedDays:used,totalDays:total,refund,formula:`${paid.toLocaleString('ko-KR')}원 − ${used}일/${total}일 사용분 = ${refund.toLocaleString('ko-KR')}원`};
}
/** 작업 069: 사업자등록번호 검증(국세청 검증식) */
export function validBizNo(v:string){
 const d=v.replace(/\D/g,'');if(d.length!==10)return false;const w=[1,3,7,1,3,7,1,3,5];let s=0;
 for(let i=0;i<9;i++)s+=Number(d[i])*w[i];s+=Math.floor(Number(d[8])*5/10);return (10-s%10)%10===Number(d[9]);
}
