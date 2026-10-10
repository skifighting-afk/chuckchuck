import type {HrContext,HrScope} from '../../lib/hr/types';
import {staffGone} from '../../lib/staff-access';
import {canHr} from '../../lib/hr/access';
import {manualVisibleTo} from '../../lib/manual-view';
import {notFound} from './context';
export const hrToday=(ctx:HrContext)=>new Date(Date.parse(ctx.now)+9*3600000).toISOString().slice(0,10);
export const activePeople=(ctx:HrContext)=>ctx.store.employees.filter(e=>e.branchId===ctx.branchId&&!staffGone(e));
export function person(ctx:HrContext,id:string){const e=activePeople(ctx).find(e=>e.id===id);if(!e)notFound();return e}
export function currentAssignee(ctx:HrContext,id:string,scope:HrScope){return activePeople(ctx).some(e=>e.id===id)&&ctx.grants.some(g=>g.employeeId===id&&g.scope===scope&&g.branchId===ctx.branchId&&!g.revokedAt&&(!g.validUntil||g.validUntil>ctx.now))}
export function readableManual(ctx:HrContext,id:string|null,employeeIds:string[]=[]){if(!id)return;const m=ctx.store._manuals?.find(m=>m.id===id&&(m.branchId==='all'||m.branchId===ctx.branchId));if(!m||employeeIds.some(id=>!manualVisibleTo(m,person(ctx,id)))||(ctx.access!=='owner'&&!manualVisibleTo(m,person(ctx,ctx.selfId!))))notFound();return m}
export const isManager=(ctx:HrContext,scope:HrScope)=>canHr(ctx,scope,'manage');
