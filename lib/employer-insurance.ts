// 작업 033: 사장님 부담 4대보험(국민연금·건강·장기요양·고용 + 산재). 근로자 부담분과 같은 기준·요율표.
// 국민연금·건강·장기요양은 근로자와 같은 금액, 고용보험은 실업급여 요율 + 고용안정·직업능력개발 0.25%(150명 미만),
// 산재보험은 업종별 요율(설정에서 입력, 근로소득 직원 전원 적용 — 단시간도 포함).
import {insuranceLines,ratesFor} from './pay-rules';
export const EMPLOYER_STABILITY=0.0025;
const floor10=(n:number)=>Math.floor(n/10)*10;
export type EmployerLine={name:string,amount:number,formula:string};
export function employerInsurance(row:{gross:number,earnings:{amount:number,taxFree?:boolean}[]},e:{income:string,insurances:Record<string,{status:string}>},month:string,industrialRate=0){
 if(e.income!=='근로소득')return {lines:[] as EmployerLine[],total:0,base:0};
 const year=Number(month.slice(0,4)),r=ratesFor(year),base=Math.max(0,row.gross-row.earnings.filter(i=>i.taxFree).reduce((n,i)=>n+i.amount,0));
 const lines:EmployerLine[]=insuranceLines(base,year,e.insurances,month).filter(l=>l.name!=='고용보험').map(l=>({...l}));
 if(e.insurances?.['고용보험']?.status==='가입')lines.push({name:'고용보험',amount:floor10(base*(r.employment+EMPLOYER_STABILITY)),formula:`${base.toLocaleString('ko-KR')}원 × ${((r.employment+EMPLOYER_STABILITY)*100).toFixed(2)}% (실업급여 ${(r.employment*100).toFixed(1)}% + 고용안정 0.25%)`});
 const ind=Math.max(0,Math.min(0.2,industrialRate));if(ind>0)lines.push({name:'산재보험',amount:floor10(base*ind),formula:`${base.toLocaleString('ko-KR')}원 × ${(ind*100).toFixed(3)}% (업종 요율)`});
 return {lines,total:lines.reduce((n,l)=>n+l.amount,0),base};
}
