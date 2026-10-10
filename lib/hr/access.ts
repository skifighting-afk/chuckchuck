import type {HrContext,HrScope} from './types';
export function canHr(ctx:HrContext,scope:HrScope,operation:'read'|'write'|'manage',record?:{employeeId?:string;assigneeId?:string;buddyId?:string}):boolean{
 if(ctx.access==='owner')return true;
 const delegated=ctx.grants.some(g=>g.scope===scope&&g.employeeId===ctx.selfId&&g.branchId===ctx.branchId&&!g.revokedAt&&(!g.validUntil||Date.parse(g.validUntil)>Date.parse(ctx.now)));
 if(operation==='manage')return delegated;
 if(delegated)return true;
 if(scope==='hiring')return false;
 if(!record)return operation==='read';
 if(record.employeeId===ctx.selfId)return true;
 return scope==='training'&&record.buddyId===ctx.selfId;
}
