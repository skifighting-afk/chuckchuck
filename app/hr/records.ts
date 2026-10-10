import type {HrMeta,HrContext,HrDatabase} from '../../lib/hr/types';
import {notFound,conflict,HrError} from './context';
export type HrTable='hr_candidates'|'hr_buddy_assignments'|'hr_skill_definitions'|'hr_skill_records'|'hr_work_preferences'|'hr_meetings'|'hr_meeting_actions'|'hr_meeting_comments';
export function makeRecord<T extends object>(ctx:HrContext,data:T):T&HrMeta{return {...data,id:crypto.randomUUID(),ownerId:ctx.ownerId,branchId:ctx.branchId,createdBy:ctx.userId,createdAt:ctx.now,updatedAt:ctx.now,version:1}}
export function revise<T extends HrMeta>(ctx:HrContext,record:T,patch:Partial<T>):T{return {...record,...patch,id:record.id,ownerId:record.ownerId,branchId:record.branchId,createdBy:record.createdBy,createdAt:record.createdAt,updatedAt:ctx.now,version:record.version+1}}
function fromRow<T extends HrMeta>(r:any):T{return {...(typeof r.data==='string'?JSON.parse(r.data):r.data),id:r.id,ownerId:r.owner,branchId:r.branch_id,createdBy:r.created_by,createdAt:r.created_at,updatedAt:r.updated_at,version:r.version}}
export async function listRecords<T extends HrMeta>(db:HrDatabase,ctx:HrContext,table:HrTable):Promise<T[]>{return (await db.prepare(`SELECT * FROM ${table} WHERE owner=? AND branch_id=? ORDER BY updated_at DESC,id`).bind(ctx.ownerId,ctx.branchId).all()).results.map(r=>fromRow<T>(r))}
export async function getRecord<T extends HrMeta>(db:HrDatabase,ctx:HrContext,table:HrTable,id:string):Promise<T>{const r=await db.prepare(`SELECT * FROM ${table} WHERE owner=? AND branch_id=? AND id=?`).bind(ctx.ownerId,ctx.branchId,id).first();if(!r)notFound();return fromRow<T>(r)}
export function expectVersion(record:HrMeta,version:unknown){if(record.version!==version)conflict()}
export async function putRecord<T extends HrMeta>(db:HrDatabase,ctx:HrContext,table:HrTable,next:T,previous?:T):Promise<T>{
 if(previous){const r=await db.prepare(`UPDATE ${table} SET data=?,version=?,updated_at=? WHERE owner=? AND branch_id=? AND id=? AND version=?`).bind(JSON.stringify(next),next.version,ctx.now,ctx.ownerId,ctx.branchId,next.id,previous.version).run();if(!r.meta.changes)conflict()}
 else{const count=await db.prepare(`SELECT count(*) AS n FROM ${table} WHERE owner=? AND branch_id=?`).bind(ctx.ownerId,ctx.branchId).first<any>();if(Number(count?.n)>=2000)throw new HrError(400,'저장 한도에 도달했어요. 보관 설정과 이전 기록을 확인해 주세요.');await db.prepare(`INSERT INTO ${table}(owner,id,branch_id,data,version,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`).bind(ctx.ownerId,next.id,ctx.branchId,JSON.stringify(next),next.version,ctx.userId,ctx.now,ctx.now).run()}
 return next;
}
