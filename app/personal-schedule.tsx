import {useState} from 'react';
import {type Team,today,datePlus} from '../lib/team-model';

export function PersonalSchedule({shifts,selfId}:{shifts:Team['shifts'],selfId:string}){
 const [start,setStart]=useState(today());
 const days=Array.from({length:7},(_,i)=>datePlus(start,i));
 const own=shifts.filter(s=>s.employeeId===selfId&&s.date>=start&&s.date<=days[6])
  .sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
 const dateLabel=(date:string)=>new Date(date+'T12:00:00+09:00').toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short'});
 return <section className="panel personal-schedule" aria-label="내 근무표">
  <div className="panel-heading"><div><h2>내 근무표</h2><p>내가 일하는 날과 시간만 모았어요.</p></div></div>
  <div className="personal-schedule-nav">
   <button className="btn" onClick={()=>setStart(datePlus(start,-7))} aria-label="내 근무표 이전 7일">← 이전</button>
   <button className="btn" onClick={()=>setStart(today())}>오늘부터</button>
   <button className="btn" onClick={()=>setStart(datePlus(start,7))} aria-label="내 근무표 다음 7일">다음 →</button>
  </div>
  <p className="personal-schedule-range" aria-live="polite">{start.replaceAll('-','.')} ~ {days[6].replaceAll('-','.')} · 근무 {new Set(own.map(s=>s.date)).size}일</p>
  {!own.length&&<p className="personal-schedule-empty">이 기간에 등록된 내 근무가 없어요. 일정이 다르면 사장님께 확인해 주세요.</p>}
  <ol className="personal-schedule-days">{days.map(date=>{
   const list=own.filter(s=>s.date===date);
   return <li key={date} className={date===today()?'is-today':''}>
    <div className="personal-schedule-date"><time dateTime={date}>{dateLabel(date)}</time>{date===today()&&<span>오늘</span>}</div>
    <div className="personal-schedule-times">{list.length?list.map(s=><div key={s.id}><strong>{s.start} ~ {s.end}{s.end<=s.start&&<small> (다음 날)</small>}</strong><span>휴게 {s.breakMinutes}분</span></div>):<span className="personal-no-shift">등록된 근무 없음</span>}</div>
   </li>;
  })}</ol>
  <p className="personal-schedule-note">예정된 근무시간이에요. 실제 출퇴근 기록은 ‘내 근무’에서 확인해요.</p>
 </section>;
}
