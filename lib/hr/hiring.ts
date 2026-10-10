import {z} from 'zod';
import {commandSchema,text,requiredText,instantSchema} from './schemas';
import {CANDIDATE_STAGES,type Candidate} from './types';
export const hiringSchema=z.discriminatedUnion('action',[
 commandSchema.extend({action:z.literal('save'),id:requiredText(100).optional(),name:requiredText(40),phone:text(30),role:requiredText(20),availability:text(1000),source:text(80),questions:text(2000)}),
 commandSchema.extend({action:z.literal('stage'),id:requiredText(100),stage:z.enum(CANDIDATE_STAGES),interviewAt:instantSchema.nullable()}),
 commandSchema.extend({action:z.literal('convert'),id:requiredText(100),mode:z.enum(['new','link']),employeeId:requiredText(100).optional(),storeVersion:z.number().int().min(1),confirmed:z.literal(true)}),
 commandSchema.extend({action:z.literal('retentionSettings'),candidateRetentionDays:z.number().int().min(1).max(3650).nullable()}),
 commandSchema.extend({action:z.literal('archive'),id:requiredText(100)})
]);
export function candidatePurgeAt(c:Candidate,days:number|null):string|null{return days&&c.closedAt?new Date(Date.parse(c.closedAt)+days*86400000).toISOString():null}
