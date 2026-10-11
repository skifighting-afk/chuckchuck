export type WorkView='day'|'week'|'month';
type Period={page:string;month:string;day:string;week:string;scheduleView?:WorkView;attendanceView?:WorkView;weekStart?:'sun'|'mon'};
const dayValue=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const dateText=(v:string)=>v.replaceAll('-','.');
const addDays=(v:string,n:number)=>new Date(Date.parse(v+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const monthRange=(v:string)=>{const from=v.slice(0,7)+'-01',next=new Date(from+'T00:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);return dateText(from)+'–'+dateText(new Date(+next-86400000).toISOString().slice(0,10))};
export function workPeriod(p:Period):string|null{
 if(p.page==='급여·명세서')return dayValue(p.month+'-01')?monthRange(p.month+'-01')+' · 월 급여':null;
 const schedule=p.page==='근무 스케줄';if(!schedule&&p.page!=='출퇴근 기록')return null;
 const value=schedule?p.week:p.day,view=(schedule?p.scheduleView:p.attendanceView)||'day';if(!dayValue(value))return null;
 const type=schedule?'근무표':'출퇴근';
 if(view==='month')return monthRange(value)+' · 월간 '+type;
 if(view==='week'){const weekday=new Date(value+'T00:00:00Z').getUTCDay(),from=schedule?value:addDays(value,-(p.weekStart==='sun'?weekday:(weekday+6)%7));return dateText(from)+'–'+dateText(addDays(from,6))+' · 주간 '+type}
 return dateText(value)+' · 일간 '+type;
}
type RecordTime={start:string;end:string|null;breakMinutes:number;credit?:{start:string;end:string}|null};
export function attendancePayTime(a:RecordTime,locked:boolean){
 const breakMinutes=Number.isFinite(a.breakMinutes)?Math.max(0,a.breakMinutes):0;
 const span=(start:string,end:string|null)=>{const n=end?(Date.parse(end)-Date.parse(start))/60000:NaN;return Number.isFinite(n)&&n>=0?n:null};
 const raw=span(a.start,a.end),paid=a.credit&&a.end?span(a.credit.start,a.credit.end):raw;
 return {rawMinutes:raw===null?null:Math.round(raw),breakMinutes,paidMinutes:paid===null||raw===null?null:Math.round(Math.max(0,paid-breakMinutes)),changed:!!a.end&&!!a.credit&&(Date.parse(a.start)!==Date.parse(a.credit.start)||Date.parse(a.end)!==Date.parse(a.credit.end)),status:!a.end?'퇴근 전 · 계산 대기':locked?'확정됨 · 명세서 기준 확인':'미확정 · 현재 기록'};
}
