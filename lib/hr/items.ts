import {z} from 'zod';import {commandSchema,requiredText,text,dateSchema} from './schemas';import type {ItemAssignment} from './types';
const id=requiredText(100),quantity=z.number().int().min(1).max(999),target=commandSchema.extend({id});
export const itemsSchema=z.discriminatedUnion('action',[
 commandSchema.extend({action:z.literal('issue'),employeeId:id,name:requiredText(80),quantity,note:text(500),dueAt:dateSchema.nullable()}),
 target.extend({action:z.literal('ack')}),target.extend({action:z.literal('requestReturn'),dueAt:dateSchema,note:text(500)}),
 target.extend({action:z.literal('return'),quantity,note:text(500)}),target.extend({action:z.literal('lost'),quantity,note:requiredText(500)})
]);
export function outstandingItems(rows:ItemAssignment[],employeeId:string):ItemAssignment[]{return rows.filter(r=>r.employeeId===employeeId&&r.issued-r.returned-r.lost>0)}
