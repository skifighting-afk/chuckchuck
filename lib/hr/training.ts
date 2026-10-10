import {z} from 'zod';
import {commandSchema,requiredText,text,dateSchema} from './schemas';
import {SKILL_LEVELS} from './types';
const id=requiredText(100),manualId=id.nullable();
export const trainingSchema=z.discriminatedUnion('action',[
 commandSchema.extend({action:z.literal('assignBuddy'),employeeId:id,buddyId:id,from:dateSchema,until:dateSchema,steps:z.array(z.object({title:requiredText(100),manualId})).min(1).max(30)}),
 commandSchema.extend({action:z.literal('updateStep'),id,stepId:id,progress:z.enum(['todo','doing','awaiting_ack']),note:text(1000)}),
 commandSchema.extend({action:z.literal('ackStep'),id,stepId:id}),
 commandSchema.extend({action:z.literal('reassignBuddy'),id,buddyId:id}),
 commandSchema.extend({action:z.literal('saveSkill'),id:id.optional(),name:requiredText(100),manualId,archived:z.boolean().optional()}),
 commandSchema.extend({action:z.literal('setLevel'),id:id.optional(),employeeId:id,skillId:id,level:z.enum(SKILL_LEVELS),note:text(1000)}),
 commandSchema.extend({action:z.literal('requestReview'),id})
]);
