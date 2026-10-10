import {z} from 'zod';import {commandSchema,requiredText} from './schemas';
const id=requiredText(100),target=commandSchema.extend({id});
export const casesSchema=z.discriminatedUnion('action',[
 commandSchema.extend({action:z.literal('submit'),subject:requiredText(100),body:requiredText(2000),assigneeId:id.nullable(),visibilityConfirmed:z.literal(true)}),
 target.extend({action:z.literal('reply'),body:requiredText(2000)}),target.extend({action:z.literal('status'),status:z.enum(['reviewing','closed'])}),
 target.extend({action:z.literal('reassign'),assigneeId:id.nullable()}),target.extend({action:z.literal('reopen')})
]);
export const caseNotification={title:'의견·상담에 새 소식이 있어요',body:'로그인한 뒤 공개 범위에 맞는 내용을 확인해 주세요.',url:'/hr?view=cases'};
