import {resolveStore} from '../saas-api';
import {staffGone} from '../../lib/staff-access';
import type {HrContext,HrDatabase,HrGrant,HrContextView} from '../../lib/hr/types';
import {HR_SCOPES} from '../../lib/hr/types';
import {canHr} from '../../lib/hr/access';
export class HrError extends Error{constructor(public status:number,message:string){super(message)}}
export function deny(message='접근 권한이 없어요. 사장님께 담당 범위를 확인해 주세요.'):never{throw new HrError(403,message)}
export function notFound():never{throw new HrError(404,'기록을 찾을 수 없어요. 목록을 새로고침해 주세요.')}
export function conflict():never{throw new HrError(409,'다른 변경이 있어요. 입력을 복사해 두고 최신 내용을 확인해 주세요.')}
export function asHrDatabase(db:D1Database):HrDatabase{const pg=db as unknown as HrDatabase;if(typeof pg.transaction!=='function'||typeof pg.client?.begin!=='function')throw new Error('HR requires PostgreSQL transactions');return pg}
export function grantRow(r:any):HrGrant{return{id:r.id,ownerId:r.owner,branchId:r.branch_id,employeeId:r.employee_id,scope:r.scope,validUntil:r.valid_until,revokedAt:r.revoked_at,createdBy:r.created_by,createdAt:r.created_at,updatedAt:r.updated_at,version:r.version}}
export async function contextFromRow(db:HrDatabase,userId:string,row:{owner:string;data:string;version:number},branchId?:string):Promise<HrContext>{
 const raw=JSON.parse(row.data),member=raw._members?.find((m:any)=>m.userId===userId),self=raw.employees?.find((e:any)=>e.id===member?.employeeId);
 const owner=row.owner===userId||(raw._coowners||[]).some((c:any)=>c.userId===userId);
 if(!owner&&(staffGone(self)||self?.anonymizedAt))deny();
 const branch=branchId||(owner?raw.branches[0]?.id:self.branchId);
 if(!raw.branches.some((b:any)=>b.id===branch)||(!owner&&branch!==self.branchId))deny();
 const now=new Date().toISOString(),grants=(await db.prepare('SELECT * FROM hr_grants WHERE owner=? AND branch_id=? AND revoked_at IS NULL').bind(row.owner,branch).all()).results.map(grantRow);
 return{userId,ownerId:row.owner,access:owner?'owner':self.access==='중간관리자'?'manager':'employee',coowner:owner&&row.owner!==userId,selfId:owner?null:self.id,branchId:branch,store:raw,storeVersion:row.version,grants,now};
}
export async function resolveHrContext(request:Request,env:{DB:HrDatabase},branchId?:string):Promise<HrContext>{
 const uid=request.headers.get('oai-authenticated-user-id');if(!uid)throw new HrError(401,'로그인한 뒤 다시 열어 주세요.');
 const linked=await resolveStore(env.DB as unknown as D1Database,uid);if(!linked||linked.access==='revoked')deny();
 return contextFromRow(env.DB,uid,linked.row,branchId);
}
export function contextView(ctx:HrContext):HrContextView{
 const e=ctx.store.employees,active=e.filter(x=>x.branchId===ctx.branchId&&!x.anonymizedAt&&!staffGone(x)),scopes=HR_SCOPES.filter(s=>canHr(ctx,s,'manage'));
 const receivers=active.filter(x=>ctx.grants.some(g=>g.employeeId===x.id&&g.scope==='cases'&&!g.revokedAt&&(!g.validUntil||Date.parse(g.validUntil)>Date.parse(ctx.now)))).map(x=>({id:x.id,name:x.name}));
 return{access:ctx.access,coowner:ctx.coowner,selfId:ctx.selfId,branchId:ctx.branchId,storeName:ctx.store.store.name,branches:ctx.store.branches.filter(b=>ctx.access==='owner'||b.id===ctx.branchId).map(b=>({id:b.id,name:b.name})),employees:active.filter(x=>ctx.access==='owner'||scopes.length||x.id===ctx.selfId).map(x=>({id:x.id,name:x.name,role:x.role})),receivers,scopes:[...scopes]};
}
