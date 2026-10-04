import {attendanceSchema,type Team} from './team-model';
export function correctionError(records:Team['attendance'],before:any,after:any):string|null{
 const parsed=attendanceSchema.safeParse(after);
 if(!parsed.success||after.id!==before.id||after.employeeId!==before.employeeId)return '수정할 출퇴근 기록을 확인해 주세요.';
 const start=Date.parse(after.start),end=after.end?Date.parse(after.end):Infinity;
 if(records.some(a=>a.id!==before.id&&a.employeeId===before.employeeId&&start<(a.end?Date.parse(a.end):Infinity)&&end>Date.parse(a.start)))return '다른 출퇴근 기록과 시간이 겹쳐요. 시간을 다시 확인해 주세요.';
 return null;
}
