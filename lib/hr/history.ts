import type {HrMeta,HrContext,HrChange} from './types';
// Private histories travel only with their already-authorized HR record; never general audit.
export function changeHistory(c:Pick<HrContext,'now'|'userId'|'selfId'>,old:HrMeta,patch:object):HrChange[]{
 const r=old as HrMeta&Record<string,unknown>,p=patch as Record<string,unknown>;
 const keys='skillId'in r?['level','note','checkedBy','checkedAt']:'buddyId'in r?['buddyId','from','until']:'periodKey'in r?['unit','min','max','reviewNote','reviewedBy','reviewedAt']:'assigneeId'in r?['assigneeId']:[];
 const changed=keys.filter(k=>k in p&&p[k]!==r[k]),before:HrChange['before']={},after:HrChange['after']={};
 for(const k of changed){before[k]=(r[k]??null) as string|number|null;after[k]=(p[k]??null) as string|number|null}
 return [...(old.changes||[]),...(changed.length?[{at:c.now,by:c.userId,byEmployeeId:c.selfId,before,after}]:[])];
}
