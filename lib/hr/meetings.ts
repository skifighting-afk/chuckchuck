import {z} from 'zod';import {commandSchema,requiredText,text,instantSchema,dateSchema} from './schemas';
const id=requiredText(100),target=commandSchema.extend({id});
export const meetingsSchema=z.discriminatedUnion('action',[
 commandSchema.extend({action:z.literal('save'),id:id.optional(),employeeId:id,assigneeId:id,scheduledAt:instantSchema,topic:requiredText(100),sharedSummary:text(2000),privateNote:text(2000),status:z.enum(['scheduled','held','closed'])}),
 target.extend({action:z.literal('share'),confirmed:z.literal(true)}),target.extend({action:z.literal('ack')}),
 target.extend({action:z.literal('comment'),body:requiredText(1000)}),target.extend({action:z.literal('reassign'),assigneeId:id}),
 commandSchema.extend({action:z.literal('action'),id:id.optional(),meetingId:id,actionVersion:z.number().int().positive().optional(),text:requiredText(200),employeeId:id,due:dateSchema}),
 commandSchema.extend({action:z.literal('actionComplete'),id,meetingId:id,actionVersion:z.number().int().positive()})
]);
