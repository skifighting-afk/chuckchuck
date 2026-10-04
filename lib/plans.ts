export const plans = {
 free:{id:'free',name:'무료',price:0,employees:3,branches:1,description:'직원 3명까지, 우리 가게 첫 시작'},
 starter:{id:'starter',name:'사장님 5',price:19900,employees:5,branches:1,description:'직원 5명 이하 작은 매장'},
 team:{id:'team',name:'사장님 10',price:29900,employees:10,branches:1,description:'직원 10명 이하 매장'},
 multi:{id:'multi',name:'여러 매장',price:29900,employees:10,branches:2,description:'매장당 직원 10명 · 2곳부터 통합 관리'},
} as const;
export type PlanId=keyof typeof plans;
export const TRIAL_DAYS=14;
export const money=(n:number)=>n.toLocaleString('ko-KR');
export function isPlan(v:unknown):v is PlanId{return typeof v==='string'&&Object.hasOwn(plans,v)}
export function trialStatus(a:any,now=Date.now()){
 if(!a)return 'legacy';if(a.plan==='free')return 'free';
 if(a.status==='cancelled')return 'cancelled';
 return Date.parse(a.trialEndsAt)>now?'trialing':'expired';
}
export function canWrite(a:any){return ['legacy','free','trialing'].includes(trialStatus(a))}
export function planLimits(a:any){
 if(!a||!isPlan(a.plan))return {employees:150,branches:50};
 return {employees:plans[a.plan as PlanId].employees,branches:a.plan==='multi'?Math.max(2,Math.min(10,Number(a.storeSlots)||2)):1};
}
export function monthlyPrice(plan:PlanId,slots=2){return plans[plan].price*(plan==='multi'?Math.max(2,Math.min(10,slots)):1)}
export function capacityError(state:any,a:any){
 const limits=planLimits(a);
 if(state.branches.length>limits.branches)return `현재 요금제는 매장 ${limits.branches}곳까지입니다. 계정·요금제에서 매장 수를 변경해 주세요.`;
 for(const branch of state.branches){const count=state.employees.filter((e:any)=>e.branchId===branch.id&&e.status!=='퇴사').length;if(count>limits.employees)return `${branch.name}의 직원이 ${count}명입니다. 매장당 ${limits.employees}명 한도를 확인해 주세요.`;}
 return '';
}
export function hasFeature(a:any,feature:'payroll'|'reports'|'leave'|'comparison'|'contracts'){
 if(!a)return true;
 if(feature==='comparison')return a.plan==='multi';
 return a.plan!=='free';
}
