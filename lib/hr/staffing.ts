import {z} from 'zod';
import {commandSchema,requiredText,text,dateSchema} from './schemas';
import {plusDays,weekStartOf,shiftHours} from '../ops-view';
import type {StoreData} from '../store-data';
import type {WorkPreference,StaffingRow} from './types';
export function staffingPeriod(period:'week'|'month',key:string,ws:'mon'|'sun'='mon'){
 if(period==='week'){dateSchema.parse(key);if(weekStartOf(key,ws)!==key)throw Error('주 시작일을 선택해 주세요.');return{from:key,to:plusDays(key,6)}}
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(key))throw Error('대상 월을 선택해 주세요.');dateSchema.parse(key+'-01');return{from:key+'-01',to:new Date(Date.UTC(Number(key.slice(0,4)),Number(key.slice(5,7)),0)).toISOString().slice(0,10)};
}
export const staffingSchema=z.discriminatedUnion('action',[
 commandSchema.extend({action:z.literal('savePreference'),id:requiredText(100).optional(),employeeId:requiredText(100).optional(),period:z.enum(['week','month']),periodKey:requiredText(10),unit:z.enum(['hours','days']),min:z.number().finite().min(0),max:z.number().finite().min(0)}),
 commandSchema.extend({action:z.literal('reviewPreference'),id:requiredText(100),reviewNote:text(1000)})
]);
export function staffingSummary(store:StoreData,prefs:WorkPreference[],branchId:string,from:string,to:string):StaffingRow[]{
 const branch=store.branches.find(b=>b.id===branchId),closing=branch?.hours?.close;
 const inBranch=(s:StoreData['shifts'][number])=>(s.branchId||store.employees.find(e=>e.id===s.employeeId)?.branchId)===branchId;
 return store.employees.filter(e=>e.branchId===branchId||store.shifts.some(s=>s.employeeId===e.id&&inBranch(s)&&s.date>=from&&s.date<=to)).map(e=>{
  const all=store.shifts.filter(s=>s.employeeId===e.id&&inBranch(s)),selected=all.filter(s=>s.date>=from&&s.date<=to),days=[...new Set(all.map(s=>s.date))].sort();let run:string[]=[],best:string[]=[];
  const consider=()=>{if(run.some(d=>d>=from&&d<=to)&&run.length>best.length)best=[...run]};
  for(const d of days){if(run.length&&plusDays(run.at(-1)!,1)!==d){consider();run=[]}run.push(d)}consider();
  const plannedHours=Math.round(selected.reduce((n,s)=>n+shiftHours(s),0)*100)/100,shiftDays=new Set(selected.map(s=>s.date)).size;
  const pref=prefs.find(p=>p.employeeId===e.id&&(()=>{try{const r=staffingPeriod(p.period,p.periodKey,store.settings.weekStart||'mon');return r.from===from&&r.to===to}catch{return false}})()),value=pref?.unit==='days'?shiftDays:plannedHours;
  return{employeeId:e.id,plannedHours,shiftDays,weekendStarts:selected.filter(s=>[0,6].includes(new Date(s.date+'T00:00:00Z').getUTCDay())).length,closingShifts:closing?selected.filter(s=>s.end===closing).length:0,longestRun:best.length,closingConfigured:!!closing,preferenceGap:pref?(value<pref.min?value-pref.min:value>pref.max?value-pref.max:0):null,evidenceShiftIds:[...new Set([...selected.map(s=>s.id),...all.filter(s=>best.includes(s.date)).map(s=>s.id)])]};
 });
}
