// 근무표 한 달 미리 보기: 달력 칸마다 그날 일하는 사람. 칸을 누르면 그날 일간 근무표로.
import {type Team} from '../lib/team-model';
import {PUBLIC_HOLIDAYS} from '../lib/holidays';

const iso=(d:Date)=>d.toISOString().slice(0,10);
export function monthGrid(anchor:string,weekStart:'mon'|'sun'='mon'){
 const first=new Date(anchor.slice(0,7)+'-01T00:00:00Z'),offset=weekStart==='mon'?(first.getUTCDay()+6)%7:first.getUTCDay();
 const start=new Date(first.getTime()-offset*86400000),days:string[]=[];
 for(let i=0;i<42;i++){const d=iso(new Date(start.getTime()+i*86400000));if(i>=35&&d.slice(0,7)!==anchor.slice(0,7))break;days.push(d)}
 return days;
}
export function MonthSchedule({state,employees,anchor,today,onPick}:{state:Team,employees:Team['employees'],anchor:string,today:string,onPick:(date:string)=>void}){
 const weekStart=((state.settings as any).weekStart||'mon') as 'mon'|'sun',days=monthGrid(anchor,weekStart),month=anchor.slice(0,7);
 const ids=new Set(employees.map(e=>e.id)),name=(id:string)=>employees.find(e=>e.id===id)?.name||'';
 const holidays=new Map((PUBLIC_HOLIDAYS[Number(month.slice(0,4))]||[]) as [string,string][]);
 const heads=weekStart==='mon'?'월화수목금토일':'일월화수목금토';
 const shifts=state.shifts.filter(x=>ids.has(x.employeeId)&&x.date.slice(0,7)===month);
 const hours=shifts.reduce((n,x)=>{let m=(Number(x.end.slice(0,2))*60+Number(x.end.slice(3)))-(Number(x.start.slice(0,2))*60+Number(x.start.slice(3)));if(m<=0)m+=1440;return n+Math.max(0,m-x.breakMinutes)/60},0);
 return <div className="month-sched">
  <p className="month-sum">{Number(month.slice(5))}월 근무 {shifts.length}개 · 예정 근무시간 {Math.round(hours)}시간</p>
  <div className="month-grid" role="grid" aria-label={`${Number(month.slice(5))}월 근무표`}>
   {heads.split('').map((h,i)=><div key={h} role="columnheader" className={'month-head'+((weekStart==='mon'?i===6:i===0)?' sun':'')}>{h}</div>)}
   {days.map(d=>{const list=state.shifts.filter(x=>ids.has(x.employeeId)&&x.date===d).sort((a,b)=>a.start.localeCompare(b.start)),out=d.slice(0,7)!==month,hol=holidays.get(d),dow=new Date(d+'T00:00:00Z').getUTCDay();
    return <button type="button" role="gridcell" key={d} className={'month-cell'+(out?' out':'')+(d===today?' today':'')+(hol||dow===0?' sun':'')} onClick={()=>onPick(d)} aria-label={`${Number(d.slice(5,7))}월 ${Number(d.slice(8))}일${hol?' '+hol:''} 근무 ${list.length}개`}>
     <span className="month-day">{Number(d.slice(8))}{hol&&<small>{hol}</small>}</span>
     {list.length>0&&<span className="month-count">{list.length}명</span>}
     <span className="month-list">{list.slice(0,3).map(x=><span key={x.id}>{name(x.employeeId)} <i>{x.start.slice(0,2)}–{x.end.slice(0,2)}</i></span>)}{list.length>3&&<span className="month-more">+{list.length-3}</span>}</span>
    </button>})}
  </div>
  <p className="footnote">날짜를 누르면 그날 시간별 근무표로 가요. 휴대폰에서는 칸마다 일하는 사람 수만 보여요.</p>
 </div>;
}
