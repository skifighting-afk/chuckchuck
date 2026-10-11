import {billableEmployees,employeePrice,EMPLOYEE_PRICE,EMPLOYEE_PRICING_VERSION,type PlanId} from '../lib/plans';

export function billingInput(ownerId:string,data:any){
 return {ownerId,employees:data.employees||[],members:data._members||[],testEmployeeIds:data._account?.billingTestEmployeeIds||[]};
}
/** Original paid period, independent of today's employee count or pricing table. */
export function currentSubscription(account:any){
 if(!account?.periodStart||!account?.paidUntil)return null;
 return {plan:account.plan,amount:account.periodPrice??null,periodStart:account.periodStart,periodEnd:account.paidUntil,months:account.months||1,pricingVersion:account.pricingVersion||null,snapshot:account.pricingSnapshot||null,orderId:account.lastOrderId||null};
}
export function nextEmployeeEstimate(ownerId:string,data:any,plan:PlanId){
 const count=billableEmployees(billingInput(ownerId,data));
 return {pricingVersion:EMPLOYEE_PRICING_VERSION,plan,unitPrice:EMPLOYEE_PRICE[plan],count:count.count,amount:employeePrice(plan,count.count),months:1,vatIncluded:true,excluded:count.excluded};
}
