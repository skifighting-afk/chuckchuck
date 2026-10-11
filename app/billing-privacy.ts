/** Coowners administer HR records; only the representative receives billing details. */
export function sharedAccountView(account:any){
 if(!account)return null;
 const fields=['plan','status','storeSlots','createdAt','trialEndsAt','trialUsed','paidUntil','cancelAt','paymentFailedAt'];
 return Object.fromEntries(fields.filter(key=>Object.hasOwn(account,key)).map(key=>[key,account[key]]));
}
const billingActions=new Set(['요금 결제','청구 없이 이용 시작','요금 환불']);
export const sharedAuditView=(audit:any[])=>audit.filter(entry=>entry.target!=='이용권'&&!billingActions.has(entry.action));
export function redactBillingData(data:any){
 return {...data,_account:sharedAccountView(data._account),_audit:sharedAuditView(data._audit||[])};
}
