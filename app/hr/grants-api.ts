import type {HrDatabase,HrContext,HrGrant} from '../../lib/hr/types';
import {staffGone} from '../../lib/staff-access';
import {grantSchema} from '../../lib/hr/schemas';
import {grantRow,deny,notFound,HrError,conflict} from './context';
import {withHrMutation,fingerprint} from './mutation';
export async function grantsRead(db:HrDatabase,ctx:HrContext){if(ctx.access!=='owner')deny();return {grants:(await db.prepare('SELECT * FROM hr_grants WHERE owner=? AND branch_id=? ORDER BY created_at DESC').bind(ctx.ownerId,ctx.branchId).all()).results.map(grantRow)}}
export async function grantsWrite(db:HrDatabase,ctx:HrContext,input:unknown){
 const b=grantSchema.parse(input);if(ctx.access!=='owner')deny();
 const read=async(tx:HrDatabase,c:HrContext,id:string):Promise<HrGrant>=>{const r=await tx.prepare('SELECT * FROM hr_grants WHERE owner=? AND branch_id=? AND id=?').bind(c.ownerId,c.branchId,id).first();if(!r)notFound();return grantRow(r)};
 return withHrMutation(db,ctx,{...b,operation:'grants:'+b.action,fingerprint:await fingerprint(b),authorize:c=>{if(c.access!=='owner')deny()},target:r=>r.id,replay:read},async(tx,c)=>{
  if(b.action==='grant'){
   const e=c.store.employees.find(e=>e.id===b.employeeId&&e.branchId===c.branchId&&!e.anonymizedAt&&!staffGone(e));if(!e)notFound();
   if(b.validUntil&&Date.parse(b.validUntil)<=Date.parse(c.now))throw new HrError(400,'권한 만료일은 현재 이후로 골라 주세요.');
   const existing=await tx.prepare('SELECT id FROM hr_grants WHERE owner=? AND branch_id=? AND employee_id=? AND scope=? AND revoked_at IS NULL').bind(c.ownerId,c.branchId,e.id,b.scope).first();if(existing)throw new HrError(409,'이미 담당 권한이 있어요. 회수 후 새 만료일로 지정해 주세요.');
   const id=crypto.randomUUID();await tx.prepare('INSERT INTO hr_grants(owner,id,branch_id,employee_id,scope,valid_until,created_by,created_at,updated_at,version) VALUES(?,?,?,?,?,?,?,?,?,1)').bind(c.ownerId,id,c.branchId,e.id,b.scope,b.validUntil,c.userId,c.now,c.now).run();return read(tx,c,id);
  }
  const current=await read(tx,c,b.id);if(current.version!==b.version||current.revokedAt)conflict();
  await tx.prepare('UPDATE hr_grants SET revoked_at=?,updated_at=?,version=version+1 WHERE owner=? AND id=? AND version=?').bind(c.now,c.now,c.ownerId,b.id,b.version).run();return read(tx,c,b.id);
 });
}
