import {z} from 'zod';
import {seed as oldSeed,today,datePlus,duration} from './model';
import {allowances,insuranceLines,ratesFor,hasRatesFor,pendingRates,weekKeyOf} from './pay-rules';
import {incomeTax,hasTaxTable} from './income-tax';
import {holidaysFor} from './holidays';
import {attendanceBreakShortfalls,minorIssues} from './labor-checks';
export {today,datePlus,duration};
const text=z.string().trim().min(1).max(200),id=z.string().min(1).max(100),date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'실제로 존재하는 날짜를 입력해 주세요.'),money=z.number().finite().min(0).max(100000000),email=z.union([z.literal(''),z.string().email().max(254)]);
export const insuranceNames=['국민연금','건강보험','장기요양','고용보험','산재보험'] as const;
const insurance=z.object({status:z.enum(['확인 필요','가입','적용 제외']),reason:z.string().max(500)});
export const memberSchema=z.object({id,name:text,email,address:z.string().max(300).optional().default(''),phone:z.string().max(30),joined:date,branchId:id,role:z.enum(['홀','주방','매니저']),access:z.enum(['직원','중간관리자']),managerPermissions:z.array(z.enum(['schedule','attendance','leave','notices'])).max(4).default([]),employment:z.enum(['기간의 정함 없음','기간제','단시간','일용','독립 용역']),status:z.enum(['입사 준비','재직','퇴사']),endDate:z.string().max(10),healthCertUntil:z.string().max(10).optional().default(''),weeklyHours:z.number().min(0).max(80),payType:z.enum(['시급','월급','일급']),wage:money,payDay:z.number().int().min(1).max(31),income:z.enum(['미검토','근로소득','사업소득','기타소득']),taxMode:z.enum(['직접 입력','사업소득 3.3%','4대보험 자동','공제 없음·근거 확인']),autoPay:z.boolean().default(false),birthMonth:z.string().regex(/^(\d{4}-\d{2})?$/).default(''),minorDocs:z.boolean().default(false),includesJuhu:z.boolean().optional(),weeklyHoliday:z.number().int().min(0).max(6).optional(),taxFamily:z.number().int().min(1).max(20).optional(),taxChildren:z.number().int().min(0).max(10).optional(),taxRatio:z.union([z.literal(80),z.literal(100),z.literal(120)]).optional(),probation:z.object({months:z.number().int().min(0).max(3),rate:z.number().min(0.9).max(1),simpleLabor:z.boolean().optional()}).optional(),taxReason:z.string().max(1000),insurances:z.record(insurance),contract:z.object({draftText:z.string().max(20000).default(''),status:z.enum(['작성 전','검토 중','서명 대기','체결 완료']),workplace:z.string().max(300),duties:z.string().max(500),workDays:z.string().max(200),start:z.string().max(5),end:z.string().max(5),breakMinutes:z.number().int().min(0).max(720),holiday:z.string().max(300),leave:z.string().max(500),paymentMethod:z.string().max(200),additional:z.string().max(6000),employer:z.string().max(100),signedAt:z.string().nullable(),signedBy:z.string().nullable()}),leaveBalance:z.number().min(0).max(100),notes:z.string().max(1000)});
export const shiftSchema=z.object({id,employeeId:id,date,start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),breakMinutes:z.number().int().min(0).max(720)}).refine(s=>s.start!==s.end&&duration(s.start,s.end,s.breakMinutes)>0,'근무시간과 휴게시간을 확인해 주세요.');
export const attendanceSchema=z.object({id,employeeId:id,start:z.string().datetime(),end:z.string().datetime().nullable(),breakMinutes:z.number().min(0).max(1440),breakStart:z.string().datetime().nullable()}).refine(a=>!a.end||(+new Date(a.end)>+new Date(a.start)&&(+new Date(a.end)-+new Date(a.start))/60000>a.breakMinutes),'출퇴근·휴게시간을 확인해 주세요.');
export const itemSchema=z.object({name:text,amount:money,formula:z.string().max(500),taxFree:z.boolean().optional()});
export const teamSchema=z.object({schemaVersion:z.literal(2),store:z.object({name:text,branch:text}),branches:z.array(z.object({id,name:text,address:z.string().max(300)})).min(1).max(50),employees:z.array(memberSchema).max(150),shifts:z.array(shiftSchema).max(20000),attendance:z.array(attendanceSchema).max(100000),adjustments:z.record(z.object({earnings:z.array(itemSchema).max(30),deductions:z.array(itemSchema).max(30),note:z.string().max(1000),juhuKeep:z.array(z.string().max(10)).max(10).optional()})),payrollRuns:z.record(z.any()),requests:z.array(z.any()).max(1000),approvedLeaves:z.array(z.object({employeeId:id,start:date,end:date})).max(5000).optional(),staffingNeeds:z.array(z.object({weekday:z.number().int().min(0).max(6),start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),count:z.number().int().min(1).max(20),breakMinutes:z.number().int().min(0).max(720),branchId:id.optional()})).max(200).optional(),scheduleTemplates:z.array(z.object({id,name:text,items:z.array(z.object({employeeId:id,weekday:z.number().int().min(0).max(6),start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),breakMinutes:z.number().int().min(0).max(720)})).max(500)})).max(20).optional(),settings:z.object({accountantName:z.string().max(100),accountantEmail:email,autoPayslip:z.boolean(),autoContract:z.boolean(),autoAccountant:z.boolean(),employerName:z.string().max(100),fivePlus:z.boolean().default(false),attendanceTolerance:z.enum(['lenient','normal','strict']).optional(),weekStart:z.enum(['mon','sun']).optional(),industrialRate:z.number().min(0).max(20).optional(),laborBudget:z.number().int().min(0).max(10000000000).optional()}),legacy:z.any().optional()}).superRefine((s,ctx)=>{const ids=new Set(s.employees.map(e=>e.id)),branches=new Set(s.branches.map(b=>b.id));for(const key of ['employees','shifts','attendance'] as const)if(new Set(s[key].map(e=>e.id)).size!==s[key].length)ctx.addIssue({code:'custom',message:'중복된 항목입니다.'});for(const e of s.employees){if(e.taxMode==='사업소득 3.3%'&&e.income!=='사업소득')ctx.addIssue({code:'custom',message:'3.3% 적용 시 실제 사업소득 여부를 확인해 주세요.'});if(e.taxMode==='4대보험 자동'&&e.income!=='근로소득')ctx.addIssue({code:'custom',message:'4대보험 자동 공제는 근로소득 직원에게만 쓸 수 있어요.'});if(e.taxMode==='공제 없음·근거 확인'&&!e.taxReason.trim())ctx.addIssue({code:'custom',message:'공제 제외 확인 근거를 입력해 주세요.'});if(!branches.has(e.branchId))ctx.addIssue({code:'custom',message:'소속 지점이 없습니다.'});for(const i of Object.values(e.insurances))if(i.status==='적용 제외'&&!i.reason.trim())ctx.addIssue({code:'custom',message:'보험 적용 제외 사유를 입력해 주세요.'});}const emails=s.employees.map(e=>e.email.toLowerCase()).filter(Boolean);if(new Set(emails).size!==emails.length)ctx.addIssue({code:'custom',message:'이메일이 중복되었습니다.'});for(const a of [...s.shifts,...s.attendance])if(!ids.has(a.employeeId))ctx.addIssue({code:'custom',message:'직원 정보를 확인해 주세요.'});const active=s.attendance.filter(a=>!a.end);if(new Set(active.map(a=>a.employeeId)).size!==active.length)ctx.addIssue({code:'custom',message:'이미 출근한 직원입니다.'});});
export type Team=z.infer<typeof teamSchema>;export type Member=z.infer<typeof memberSchema>;
export const blankInsurance=()=>Object.fromEntries(insuranceNames.map(n=>[n,{status:'확인 필요' as const,reason:''}]));
export function newMember(branchId='branch-main'):Member{return {id:crypto.randomUUID(),name:'',email:'',address:'',phone:'',joined:today(),branchId,role:'홀',access:'직원',managerPermissions:[],employment:'단시간',status:'입사 준비',endDate:'',healthCertUntil:'',weeklyHours:20,payType:'시급',wage:12000,payDay:10,income:'미검토',taxMode:'직접 입력',autoPay:true,birthMonth:'',minorDocs:false,taxReason:'',insurances:blankInsurance(),contract:{draftText:'',status:'작성 전',workplace:'',duties:'홀 업무',workDays:'월, 화, 수, 목, 금',start:'17:00',end:'22:00',breakMinutes:30,holiday:'주휴일: 매주 일요일 (적용 요건 확인)',leave:'법령 및 사업장 적용 기준에 따름',paymentMethod:'본인 명의 계좌로 지급',additional:'',employer:'',signedAt:null,signedBy:null},leaveBalance:0,notes:''}}
export function normalizeTeam(old:any):Team{if(old?.schemaVersion===2)return teamSchema.parse(old);const base=old||oldSeed();return {schemaVersion:2,store:base.store,branches:[{id:'branch-main',name:base.store.branch,address:''}],employees:base.employees.map((e:any)=>({...newMember(),id:e.id,name:e.name,phone:e.phone||'',joined:e.joined,role:e.role,wage:e.wage,status:'입사 준비',employment:e.type==='정직원'?'기간의 정함 없음':'단시간',weeklyHours:e.type==='정직원'?40:20,income:e.income||'미검토',contract:{...newMember().contract,status:'작성 전',workplace:base.store.branch,additional:(e.contractText||'').slice(0,6000)}})),shifts:base.shifts,attendance:base.attendance,adjustments:Object.fromEntries(Object.entries(base.adjustments||{}).map(([k,v]:[string,any])=>[k,{earnings:v.allowance?[{name:'기존 추가수당',amount:v.allowance,formula:v.note||'세부 계산 근거 확인 필요'}]:[],deductions:v.deduction?[{name:'기존 공제',amount:v.deduction,formula:v.note||'세부 공제 근거 확인 필요'}]:[],note:v.note||''}])),payrollRuns:{},requests:[],settings:{accountantName:'',accountantEmail:'',autoPayslip:true,autoContract:true,autoAccountant:false,employerName:'',fivePlus:false},legacy:{employees:base.employees,purchases:base.purchases||[],reservations:base.reservations||[]}}}
export const kdate=(v:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(v));
export const clock=(v:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v));
export const won=(n:number)=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0}).format(n);
export function worked(a:Team['attendance'][number]){return a.end?Math.max(0,(+new Date(a.end)-+new Date(a.start))/3600000-a.breakMinutes/60):0}
export function calculate(s:Team,month:string){
 const fivePlus=!!(s.settings as any).fivePlus,year=Number(month.slice(0,4)),weekStart=(s.settings as any).weekStart==='sun'?'sun':'mon';
 return s.employees.map(e=>{
  const mine=s.attendance.filter(a=>a.employeeId===e.id&&a.end),list=mine.filter(a=>kdate(a.start).startsWith(month));
  const hours=list.reduce((n,a)=>n+worked(a),0),days=new Set(list.map(a=>kdate(a.start))).size;
  // 수습 감액(최저임금법 제5조제2항): 1년 이상 계약 + 수습 3개월 이내 + 단순노무 아님일 때만, 임금의 90%까지
  const prob=probation(e as any,year),inProb=(d:string)=>!!prob.until&&d<prob.until,rate=prob.ok?prob.rate:1;
  const probHours=list.filter(a=>inProb(kdate(a.start))).reduce((n,a)=>n+worked(a),0),probDays=new Set(list.filter(a=>inProb(kdate(a.start))).map(a=>kdate(a.start))).size;
  const monthDays=new Date(Date.UTC(year,Number(month.slice(5,7)),0)).getUTCDate();
  const probMonthDays=prob.until?Array.from({length:monthDays},(_,k)=>month+'-'+String(k+1).padStart(2,'0')).filter(d=>inProb(d)&&d>=(e as any).joined).length:0;
  let base:number,formula:string;
  if(e.payType==='월급'){const first=month+'-01',last=month+'-'+String(monthDays).padStart(2,'0'),from=(e as any).joined>first?(e as any).joined:first,to=e.status==='퇴사'&&e.endDate&&e.endDate<last?e.endDate:last,emp=from>to?0:Math.round((Date.parse(to)-Date.parse(from))/86400000)+1,partial=emp<monthDays;base=Math.round(e.wage*(emp-(1-rate)*probMonthDays)/monthDays);formula='등록 월급'+(partial?` × 재직 ${emp}일/${monthDays}일 (${from===first?'':(e as any).joined+' 입사'}${from!==first&&to!==last?' · ':''}${to===last?'':e.endDate+' 퇴사'} 일할)`:'')+(rate<1&&probMonthDays?` (수습 ${probMonthDays}일 ${Math.round(rate*100)}% 일할)`:'')+' (결근 공제는 별도 검토)';}
  else if(e.payType==='일급'){base=Math.round((days-probDays)*e.wage+probDays*e.wage*rate);formula=days+'일 × '+won(e.wage)+'원'+(rate<1&&probDays?` (수습 ${probDays}일은 ${Math.round(rate*100)}%)`:'');}
  else {base=Math.round((hours-probHours)*e.wage+probHours*e.wage*rate);formula=hours.toFixed(2)+'시간 × '+won(e.wage)+'원'+(rate<1&&probHours?` (수습 ${probHours.toFixed(2)}시간은 ${Math.round(rate*100)}%)`:'');}
  const adj=s.adjustments[month+':'+e.id]||{earnings:[],deductions:[],note:''};
  const allProb=rate<1&&!!prob.until&&month+'-'+String(monthDays).padStart(2,'0')<prob.until;
  // 휴일: 공휴일(5명 이상)·근로자의 날 + 직원별 주휴일 요일
  const hol=new Map([...holidaysFor(year-1,fivePlus),...holidaysFor(year,fivePlus)]),wh=(e as any).weeklyHoliday;
  if(typeof wh==='number')for(const a of mine){const d=kdate(a.start);if(new Date(d+'T00:00:00Z').getUTCDay()===wh&&!hol.has(d))hol.set(d,'주휴일');}
  // 주휴 개근(작업 026): 근무표의 근무일에 출근 기록·승인 휴가·휴일이 모두 없으면 그 주는 결근 → 주휴 제외(사장님이 '개근 인정'하면 지급)
  const workedDays=new Set(mine.map(a=>kdate(a.start))),leaveDays=new Set<string>();
  for(const l of ((s as any).approvedLeaves||[]).filter((l:any)=>l.employeeId===e.id))for(let d=l.start;d<=l.end;d=new Date(Date.parse(d+'T00:00:00Z')+86400000).toISOString().slice(0,10))leaveDays.add(d);
  const keep=new Set<string>((adj as any).juhuKeep||[]),skip=new Set<string>(),today0=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  for(const sh of s.shifts.filter(x=>x.employeeId===e.id&&x.date<today0))if(!workedDays.has(sh.date)&&!leaveDays.has(sh.date)&&!hol.has(sh.date)){const k=weekKeyOf(sh.date,weekStart);if(!keep.has(k))skip.add(k);}
  // 작업 027: 일급·월급 직원도 통상시급으로 연장·야간·휴일 가산. 월급은 주휴 포함(기본), 일급은 주휴 별도(기본).
  const ordinary=ordinaryHourly(e as any);
  const hourly=e.payType==='시급'?(allProb?e.wage*rate:e.wage):ordinary.hourly;
  let auto:{lines:any[],notes:string[]}=e.autoPay&&hourly>0?allowances(mine,month,hourly,fivePlus,weekStart,hol,skip):{lines:[],notes:[] as string[]};
  if(e.payType!=='시급'&&auto.lines.length){const incl=(e as any).includesJuhu??(e.payType==='월급');auto={...auto,lines:auto.lines.filter(l=>!(incl&&l.name==='주휴수당')).map(l=>({...l,formula:l.formula+` · 통상시급 ${won(hourly)}원(${ordinary.basis})`}))};}
  const manual=new Set(adj.earnings.map(x=>x.name));
  const earnings:any[]=[{name:'기본급',amount:base,formula},...auto.lines.filter(x=>!manual.has(x.name)),...adj.earnings];
  const gross=earnings.reduce((n,a)=>n+a.amount,0),taxFree=earnings.filter(x=>x.taxFree).reduce((n,a)=>n+a.amount,0);
  const deductions=[...adj.deductions];
  if(e.taxMode==='사업소득 3.3%'&&!deductions.some(x=>x.name==='사업소득 원천징수'))deductions.push({name:'사업소득 원천징수',amount:Math.floor(gross*0.033),formula:'총액 × 3.3% (원 미만 버림·소득 구분 및 세액 별도 검토)'});
  // 4대보험은 비과세 수당(식대 등)을 뺀 금액으로 계산
  if(e.taxMode==='4대보험 자동')for(const x of insuranceLines(gross-taxFree,year,e.insurances,month))if(!deductions.some(d=>d.name===x.name))deductions.push(taxFree?{...x,formula:x.formula+' · 비과세 '+won(taxFree)+'원 제외'}:x);
  // 근로소득세·지방소득세: 간이세액표(비과세 제외 월급여, 공제대상가족·자녀 수, 원천징수 비율)
  if(e.taxMode==='4대보험 자동'&&!deductions.some(d=>d.name==='근로소득세')){const tx=incomeTax(gross-taxFree,year,(e as any).taxFamily||1,(e as any).taxChildren||0,(e as any).taxRatio||100),basis=`간이세액표(${tx.year}) · 월급여 ${won(gross-taxFree)}원 · 공제대상가족 ${tx.family}명${tx.children?` · 8~20세 자녀 ${tx.children}명`:''}${tx.ratio!==100?` · ${tx.ratio}% 선택`:''}`;if(tx.incomeTax>0){deductions.push({name:'근로소득세',amount:tx.incomeTax,formula:basis});deductions.push({name:'지방소득세',amount:tx.localTax,formula:'근로소득세 × 10%'});}}
  const deduction=deductions.reduce((n,a)=>n+a.amount,0);
  const warnings=[...auto.notes];
  if(!hasRatesFor(year)&&(e.taxMode==='4대보험 자동'||e.payType==='시급'))warnings.push(year+'년 최저임금·4대보험 요율이 아직 앱에 등록되지 않아 이전 해 기준으로 계산했어요. 금액을 꼭 확인해 주세요.');
  const min=ratesFor(year).minimumWage;
  if(e.payType==='시급'&&e.wage<min)warnings.push(year+'년 최저시급('+won(min)+'원)보다 낮은 시급이에요.');
  const nextMin=ratesFor(year+1).minimumWage;
  if(month.endsWith('-12')&&hasRatesFor(year+1)&&e.payType==='시급'&&e.wage>=min&&e.wage<nextMin)warnings.push((year+1)+'년 1월부터 최저시급이 '+won(nextMin)+'원이에요. 다음 달 전에 시급을 올려 주세요.');
  {const p=pendingRates(year);if(p.length&&e.taxMode==='4대보험 자동')warnings.push(year+'년 '+p.join('·')+' 요율이 아직 발표되지 않아 이전 해 비율로 계산했어요. 발표 후 다시 계산돼요.')}
  if(prob.until&&!prob.ok&&(probHours||probDays))warnings.push('수습 감액을 적용하지 않았어요: '+prob.reason);
  if(rate<1&&e.payType==='시급'&&e.wage*rate<min*0.9)warnings.push('수습 중 시급이 최저시급의 90%('+won(min*0.9)+'원)보다 낮아요.');
  if(taxFree>200000)warnings.push('비과세 수당이 월 '+won(taxFree)+'원이에요. 식대 비과세 한도(월 20만 원) 등 항목별 한도를 확인해 주세요.');
  if(e.taxMode==='4대보험 자동'&&!hasTaxTable(year))warnings.push(year+'년 간이세액표가 아직 앱에 없어 이전 해 표로 근로소득세를 계산했어요. 금액을 확인해 주세요.');
  const shortBreaks=attendanceBreakShortfalls(list);warnings.push(...minorIssues(e as any,list,month+'-01'));
  if(shortBreaks)warnings.push('휴게시간이 법정 기준(4시간 근로에 30분, 8시간에 1시간)보다 짧은 근무가 '+shortBreaks+'건 있어요.');
  const juhuSkipped=[...skip].filter(k=>new Date(Date.parse(k+'T00:00:00Z')+6*86400000).toISOString().slice(0,7)===month).sort(),juhuKept=[...keep].sort();
  return {employeeId:e.id,name:e.name,email:e.email,branchId:e.branchId,hours,days,earnings,deductions,gross,deduction,net:gross-deduction,note:adj.note,payDay:e.payDay,payType:e.payType,warnings,juhuSkipped,juhuKept};
 });
}
/** 통상시급: 일급 ÷ 1일 소정근로시간, 월급 ÷ 월 소정근로시간((주 소정 + 주휴) × 4.345주) */
export function ordinaryHourly(e:{payType:string,wage:number,weeklyHours:number,contract:{start:string,end:string,breakMinutes:number}}){
 if(e.payType==='시급')return {hourly:e.wage,basis:'시급'};
 if(e.payType==='일급'){const h=e.contract?.start&&e.contract?.end?duration(e.contract.start,e.contract.end,e.contract.breakMinutes||0):0;return h>0?{hourly:Math.round(e.wage/h),basis:`일급 ÷ 1일 ${h}시간`}:{hourly:0,basis:'근로계약의 근무시간이 없어 계산 불가'};}
 const w=e.weeklyHours||0,juhu=w>=15?Math.min(w,40)/40*8:0,monthly=Math.round((w+juhu)*4.345);
 return monthly>0?{hourly:Math.round(e.wage/monthly),basis:`월급 ÷ 월 ${monthly}시간`}:{hourly:0,basis:'주 소정근로시간이 없어 계산 불가'};
}
/** 수습 감액 가능 여부: 1년 이상 계약(기간의 정함 없음 또는 1년 이상 기간제), 3개월 이내, 단순노무 아님 */
export function probation(e:{joined:string,employment:string,endDate?:string,probation?:{months:number,rate:number,simpleLabor?:boolean}},_year?:number){
 const p=e.probation;if(!p||!p.months)return {ok:false,until:'',rate:1,reason:''};
 const months=Math.min(3,Math.max(0,Math.floor(p.months))),d=new Date(e.joined+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+months);const until=d.toISOString().slice(0,10);
 const oneYear=e.employment==='기간의 정함 없음'||(!!e.endDate&&Date.parse(e.endDate)-Date.parse(e.joined)>=364*86400000);
 if(!oneYear)return {ok:false,until,rate:1,reason:'근로계약 기간이 1년 이상일 때만 수습 감액을 할 수 있어요.'};
 if(p.simpleLabor)return {ok:false,until,rate:1,reason:'단순노무업무는 수습 감액을 할 수 없어요.'};
 return {ok:true,until,rate:Math.min(1,Math.max(0.9,Number(p.rate)||0.9)),reason:''};
}
export function missing(e:Member){return [!e.email&&'이메일',!e.phone&&'연락처',!e.contract.workplace&&'근무장소',!e.contract.employer&&'사업주',!e.contract.workDays&&'근무일',e.income==='미검토'&&'소득 구분',e.contract.status!=='체결 완료'&&'계약 체결'].filter(Boolean) as string[]}
export function contractText(s:Team,e:Member){if(e.contract.draftText)return e.contract.draftText+'\n\n'+(e.contract.signedAt?(e.contract.signedBy?.startsWith('앱 전자서명:')?'전자서명 기록: ':'서면 체결 확인: ')+e.contract.signedBy+' / '+e.contract.signedAt:'미체결 · 당사자 확인 전 초안');return ['근로조건 확인 및 계약서',s.store.name+' · '+(s.branches.find(b=>b.id===e.branchId)?.name||''),'사용자: '+(e.contract.employer||s.settings.employerName||'미입력'),'근로자: '+e.name,'입사일: '+e.joined,'계약 형태: '+e.employment,'계약 종료일: '+(e.endDate||'기간의 정함 없음'),'근무장소: '+e.contract.workplace,'업무: '+e.contract.duties,'근무일: '+e.contract.workDays,'근무시간: '+e.contract.start+' ~ '+e.contract.end+' / 휴게 '+e.contract.breakMinutes+'분','주 소정근로시간: '+e.weeklyHours+'시간','임금: '+e.payType+' '+won(e.wage)+'원 / 매월 '+e.payDay+'일 지급','지급방법: '+e.contract.paymentMethod,'휴일: '+e.contract.holiday,'휴가: '+e.contract.leave,'추가 약정: '+(e.contract.additional||'없음'),'본 문서의 약정은 관계 법령의 강행규정을 배제하지 않습니다.',e.contract.signedAt?(e.contract.signedBy?.startsWith('앱 전자서명:')?'전자서명 기록: ':'서면 체결 확인 기록: ')+e.contract.signedBy+' / '+e.contract.signedAt:'미체결 · 당사자 확인 전 초안'].join('\n\n')}
export function retirement(e:Member,end:string,wages:number,days:number,ordinary:number){const tenure=Math.max(0,Math.floor((+new Date(end)-+new Date(e.joined))/86400000)),anniversary=new Date(e.joined+'T00:00:00Z');anniversary.setUTCFullYear(anniversary.getUTCFullYear()+1);const eligible=+new Date(end)>=+anniversary&&e.weeklyHours>=15&&e.employment!=='독립 용역';const daily=days>0?Math.max(wages/days,ordinary):0;return {tenure,eligible,daily,estimate:eligible?Math.round(daily*30*tenure/365):0}}


