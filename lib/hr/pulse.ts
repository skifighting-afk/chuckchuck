import {z} from 'zod';import {commandSchema,requiredText,text,instantSchema} from './schemas';import type {PulseCampaign,PulseAnswer,PulseSummary} from './types';
const id=requiredText(100);
export const pulseSchema=z.discriminatedUnion('action',[
 commandSchema.extend({action:z.literal('saveCampaign'),id:id.optional(),title:requiredText(100),questions:z.array(z.object({id,text:requiredText(100)})).min(1).max(5),employeeIds:z.array(id).min(1).max(150),opensAt:instantSchema,closesAt:instantSchema}),
 commandSchema.extend({action:z.literal('publish'),id}),commandSchema.extend({action:z.literal('close'),id}),
 commandSchema.extend({action:z.literal('answer'),id:id.optional(),campaignId:id,values:z.record(z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5)])),comment:text(1000),visibilityConfirmed:z.literal(true)})
]);
export function pulseSummary(c:PulseCampaign,answers:PulseAnswer[]):PulseSummary{const distributions=Object.fromEntries(c.questions.map(q=>[q.id,[0,0,0,0,0]])) as PulseSummary['distributions'],valid=new Map(answers.filter(a=>a.campaignId===c.id&&c.employeeIds.includes(a.employeeId)&&c.questions.every(q=>[1,2,3,4,5].includes(a.values[q.id]))).map(a=>[a.employeeId,a]));for(const a of valid.values())for(const q of c.questions)distributions[q.id][a.values[q.id]-1]++;return{responded:valid.size,targeted:new Set(c.employeeIds).size,distributions}}
