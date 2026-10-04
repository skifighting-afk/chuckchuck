import {z} from 'zod';
import {newMember,duration,type Team} from './team-model';
import {standardContractDraft} from './contract-template';
const required=z.string().trim().min(1).max(300),time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const joinTermsSchema=z.object({employer:z.string().trim().min(1).max(100),workplace:required,duties:required,workDays:z.string().trim().min(1).max(200),start:time,end:time,breakMinutes:z.number().int().min(0).max(720),weeklyHours:z.number().min(1).max(80),payType:z.enum(['시급','월급','일급']),employment:z.enum(['기간의 정함 없음','기간제','단시간','일용']),endDate:z.string().default(''),wage:z.number().min(1).max(100000000),payDay:z.number().int().min(1).max(31),holiday:required,leave:required,additional:z.string().max(4000)}).refine(t=>t.start!==t.end&&duration(t.start,t.end,t.breakMinutes)>0,'근무 시작·종료와 휴게시간을 확인해 주세요.').refine(t=>!t.endDate||(/^\d{4}-\d{2}-\d{2}$/.test(t.endDate)&&!Number.isNaN(Date.parse(t.endDate))&&new Date(t.endDate).toISOString().slice(0,10)===t.endDate),'계약 종료일을 확인해 주세요.').refine(t=>t.employment!=='기간제'||!!t.endDate,'기간제는 계약 종료일을 입력해 주세요.');
export type JoinTerms=z.infer<typeof joinTermsSchema>;
export const joinProfileSchema=z.object({address:z.string().trim().min(1).max(300),joined:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v),note:z.string().max(500).default('')});
export function joinMember(d:Team,a:any){
 const e={...newMember(a.branchId),name:a.name,email:a.email,phone:a.phone,joined:a.profile?.joined||newMember().joined,address:a.profile?.address||'',wage:0,weeklyHours:0};
 e.contract={...e.contract,workplace:d.branches.find(x=>x.id===a.branchId)?.name||'',employer:d.settings.employerName,duties:'',workDays:'',start:'',end:'',holiday:'',leave:''};
 if(a.terms?.fields){const t=joinTermsSchema.parse(a.terms.fields);if(t.endDate&&e.joined>t.endDate)throw Error('첫 근무일이 계약 종료일보다 늦어요.');e.endDate=t.endDate;e.payType=t.payType;e.employment=t.employment;e.wage=t.wage;e.weeklyHours=t.weeklyHours;e.payDay=t.payDay;e.contract={...e.contract,...t,status:'검토 중',draftText:'',signedAt:null,signedBy:null};}
 return e;
}
export function joinContractText(d:Team,a:any){const e=joinMember(d,a);return standardContractDraft(d,e).replace('근로자 주소: [작성 필요]','근로자 주소: '+(a.profile?.address||'[작성 필요]'))}
