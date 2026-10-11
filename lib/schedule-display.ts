type Segment={start:number;end:number};
type Range={from:number;to:number};
const minute=(v:string)=>/^\d{2}:\d{2}$/.test(v)?Number(v.slice(0,2))*60+Number(v.slice(3)):NaN;
/** Include every segment; presentation range never clips an existing shift. */
export function dailyRange(segments:Segment[],hours?:{open:string;close:string},full=false):Range {
 if(full)return {from:0,to:1440};
 const open=hours?minute(hours.open):NaN,close=hours?minute(hours.close):NaN;
 const business=Number.isFinite(open)&&Number.isFinite(close)&&open>=0&&open<1440&&close>=0&&close<1440;
 if(business&&close<=open)return {from:0,to:1440};
 const starts=segments.map(s=>s.start),ends=segments.map(s=>s.end);
 if(business){starts.push(open);ends.push(close)}
 if(!starts.length)return {from:480,to:1320};
 return {from:Math.max(0,Math.floor(Math.min(...starts)/60)*60-60),to:Math.min(1440,Math.ceil(Math.max(...ends)/60)*60+60)};
}
export function barGeometry(segment:Segment,range:Range){
 const span=range.to-range.from;
 return {left:(segment.start-range.from)/span*100,width:Math.max(segment.end-segment.start,1)/span*100};
}
type Shift={employeeId:string;date:string;start:string;end:string;breakMinutes:number;branchId?:string;position?:string;note?:string};
/** The original record remains the source of truth until the existing save succeeds. */
export function shiftChangeRows(before:Shift|undefined,after:Shift){
 if(!before)return [];
 const fields=[['employeeId','직원'],['date','근무일'],['start','출근'],['end','퇴근'],['breakMinutes','휴게'],['branchId','근무 지점'],['position','업무'],['note','메모']] as const;
 return fields.filter(([key])=>(before[key]??'')!==(after[key]??'')).map(([key,label])=>({key,label,before:String(before[key]??'')+(key==='breakMinutes'?'분':''),after:String(after[key]??'')+(key==='breakMinutes'?'분':'')}));
}
export function shiftChangeGroups<T extends Shift&{id:string}>(before:T[],after:T[]){
 const originals=new Map(before.map(s=>[s.id,s]));
 return after.flatMap(next=>{const original=originals.get(next.id);if(!original)return [];const rows=shiftChangeRows(original,next);return rows.length?[{before:original,after:next,rows}]:[]});
}
export function leaveNamesForDay(leaves:{employeeId:string;start:string;end:string}[],employees:{id:string;name:string}[],date:string){
 const ids=new Set(leaves.filter(l=>l.start<=date&&date<=l.end).map(l=>l.employeeId));
 return employees.filter(e=>ids.has(e.id)).map(e=>e.name);
}
