// 토스페이먼츠 결제 연결(결제창 v2 + 승인 API). 금액은 언제나 서버가 계산하고, 승인 때 다시 맞춰 본다.
// (테스트가 바로 불러오므로 다른 파일을 import하지 않는다)
export const TOSS_API = 'https://api.tosspayments.com';
export const tossAuth = (secret: string) => 'Basic ' + btoa(secret + ':');
/** 주문번호: 6~64자, 영문·숫자·-·_ (토스 규칙) */
export const newOrderId = (kind: 'plan' | 'contracts') => `cc-${kind === 'plan' ? 'p' : 'c'}-${Date.now().toString(36)}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
export const validOrderId = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(v);
export const validPaymentKey = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9_-]{10,200}$/.test(v);

/** 구독 기간: 아직 남은 이용 기간이 있으면 그 끝부터 이어서, 없으면 오늘부터 */
export function nextPeriod(account: {paidUntil?: string} | null | undefined, months: number, now = Date.now()) {
  const until = Date.parse(account?.paidUntil || '');
  const start = Number.isFinite(until) && until > now ? new Date(until) : new Date(now);
  const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + months);
  return {start: start.toISOString(), end: end.toISOString()};
}

/** 결제 완료를 이용 상태에 반영(체험·유예·만료 모두 'active'로, 해지 예약은 풀림) */
export function applyPlanPaid(account: any, p: {plan: string; storeSlots: number; months: number; amount: number; orderId: string}, now = Date.now()) {
  const per = nextPeriod(account, p.months, now);
  const {cancelAt, cancelRequestedAt, cancelReason, paymentFailedAt, ...rest} = account || {};
  return {...rest, status: 'active', plan: p.plan, storeSlots: p.storeSlots, months: p.months, periodStart: per.start, paidUntil: per.end, periodPrice: p.amount, lastOrderId: p.orderId};
}

/** 전자근로계약서 요금: 그 달 체결 건수 − 이미 결제한 건수 */
/** Calendar month in Korea; clamp month ends rather than overflowing into the following month. */
export function pricingPeriod(startMs:number){
 const end=new Date(startMs+9*3600000),day=end.getUTCDate();end.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+1);
 const last=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();end.setUTCDate(Math.min(day,last));
 return {start:new Date(startMs).toISOString(),end:new Date(+end-9*3600000).toISOString()};
}
export function applyPricingPaid(account:any,p:{snapshot:any,orderId:string},now=Date.now()){
 const previous=account||{},queue=previous.pendingSubscriptions||[previous.pendingSubscription].filter(Boolean);
 const latest=queue.at(-1),start=Math.max(now,Date.parse(latest?.periodEnd||previous.paidUntil||'')||0),period=pricingPeriod(start),s=p.snapshot;
 if(!s||s.months!==1||!Number.isInteger(s.amount)||s.amount<0)throw Error('Invalid pricing snapshot');
 const subscription={plan:s.plan,pricingVersion:s.version,pricingSnapshot:s,storeSlots:50,months:1,periodPrice:s.amount,periodStart:period.start,paidUntil:period.end,lastOrderId:p.orderId,status:'active'};
 if(start>now){
  const next={...subscription,periodEnd:period.end,orderId:p.orderId},pendingSubscriptions=[...queue,next];
  return {account:{...previous,pendingSubscription:pendingSubscriptions[0],pendingSubscriptions},periodStart:period.start,periodEnd:period.end};
 }
 const {cancelAt,cancelRequestedAt,cancelReason,paymentFailedAt,pendingSubscription,pendingSubscriptions,...rest}=previous;
 return {account:{...rest,...subscription},periodStart:period.start,periodEnd:period.end};
}

export function contractsDue(signedByMonth: Record<string, number>, paidByMonth: Record<string, number>, price: number) {
  return Object.keys(signedByMonth).sort().reverse().map(month => {
    const count = signedByMonth[month] || 0, paid = paidByMonth[month] || 0, due = Math.max(0, count - paid);
    return {month, count, paid, due, amount: due * price};
  });
}

/** 토스 결제 수단 이름 → 화면용 */
export const methodName = (m?: string) => ({'카드': '카드', '간편결제': '간편결제', '계좌이체': '계좌이체', '가상계좌': '가상계좌', '휴대폰': '휴대폰'} as Record<string, string>)[m || ''] || m || '';

/** 토스 오류 → 사장님이 할 일 */
export function tossErrorText(code?: string, message?: string) {
  const known: Record<string, string> = {
    ALREADY_PROCESSED_PAYMENT: '이미 처리된 결제예요. 계정·요금제 화면에서 결제 내역을 확인해 주세요.',
    PROVIDER_ERROR: '카드사·은행 쪽에서 잠시 문제가 있었어요. 잠시 뒤 다시 결제해 주세요.',
    EXCEED_MAX_CARD_INSTALLMENT_PLAN: '할부 개월 수를 줄여서 다시 결제해 주세요.',
    REJECT_CARD_PAYMENT: '카드 승인이 거절됐어요. 한도·잔액을 확인하거나 다른 카드로 결제해 주세요.',
    INVALID_CARD_EXPIRATION: '카드 유효기간을 확인하고 다시 결제해 주세요.',
    NOT_FOUND_PAYMENT_SESSION: '결제 시간이 지났어요. 결제하기를 다시 눌러 주세요.',
    UNAUTHORIZED_KEY: '결제 설정에 문제가 있어요. 고객센터로 알려 주세요.',
  };
  return known[code || ''] || (message ? `${message} 다시 시도하거나 다른 결제 수단을 골라 주세요.` : '결제를 마치지 못했어요. 다시 시도하거나 다른 결제 수단을 골라 주세요.');
}
