import {z} from 'zod';
import {HR_SCOPES} from './types';
export const text=(max:number)=>z.string().trim().max(max);
export const requiredText=(max:number)=>text(max).min(1,'내용을 입력해 주세요.');
export const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v},'날짜를 확인해 주세요.');
export const instantSchema=z.string().datetime({offset:true});
export const commandSchema=z.object({action:requiredText(40),branchId:requiredText(100),requestId:z.string().uuid(),version:z.number().int().min(1).optional()});
export const grantSchema=z.discriminatedUnion('action',[
 commandSchema.extend({action:z.literal('grant'),employeeId:requiredText(100),scope:z.enum(HR_SCOPES),validUntil:instantSchema.nullable()}),
 commandSchema.extend({action:z.literal('revoke'),id:requiredText(100),version:z.number().int().min(1)})
]);
