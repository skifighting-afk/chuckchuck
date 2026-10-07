'use client';
// 작업 053: 근무표 A4 가로 인쇄
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {type Team,type Member,datePlus,duration,kdate,worked,workedRaw} from '../lib/team-model';
import {Btn} from './team-ui';
const W=['일','월','화','수','목','금','토'];
export function PrintSchedule({s,es,week,storeName}:{s:Team,es:Member[],week:string,storeName:string}){
 const [on,setOn]=useState(false);
 useEffect(()=>{if(!on)return;const done=()=>setOn(false);window.addEventListener('afterprint',done);const t=setTimeout(()=>window.print(),50);return()=>{clearTimeout(t);window.removeEventListener('afterprint',done)}},[on]);
 const days=Array.from({length:7},(_,i)=>datePlus(week,i)),people=es.filter(e=>e.status!=='퇴사');
 const cell=(id:string,d:string)=>s.shifts.filter(x=>x.employeeId===id&&x.date===d).sort((a,b)=>a.start<b.start?-1:1);
 const hours=(id:string)=>s.shifts.filter(x=>x.employeeId===id&&x.date>=days[0]&&x.date<=days[6]).reduce((n,x)=>n+duration(x.start,x.end,x.breakMinutes),0);
 return <><Btn onClick={()=>setOn(true)}>인쇄 (A4 가로)</Btn>{on&&createPortal(<div className="print-sheet" aria-hidden="true"><h1>{storeName} 근무표 · {days[0]} ~ {days[6]}</h1><table><thead><tr><th>직원</th>{days.map(d=><th key={d}>{Number(d.slice(5,7))}/{Number(d.slice(8))} ({W[new Date(d+'T00:00:00Z').getUTCDay()]})</th>)}<th>주 합계</th></tr></thead><tbody>{people.map(e=><tr key={e.id}><th>{e.name}<small>{e.role}</small></th>{days.map(d=><td key={d}>{cell(e.id,d).map(x=><div key={x.id}>{x.start}~{x.end}{x.breakMinutes?<small> 휴게 {x.breakMinutes}분</small>:null}</div>)}</td>)}<td>{hours(e.id).toFixed(1)}시간</td></tr>)}</tbody></table><p>출력 {new Date().toLocaleString('ko-KR')} · 척척사장</p></div>,document.body)}</>
}

/** 지시서 138: 출퇴근 기록 한 달치 인쇄·PDF(원본 시각과 인정 시간을 같이) */
export function PrintAttendance({s,es,month,storeName}:{s:Team,es:Member[],month:string,storeName:string}){
 const [on,setOn]=useState(false);
 useEffect(()=>{if(!on)return;const done=()=>setOn(false);window.addEventListener('afterprint',done);const t=setTimeout(()=>window.print(),50);return()=>{clearTimeout(t);window.removeEventListener('afterprint',done)}},[on]);
 const ids=new Set(es.map(e=>e.id)),recs=s.attendance.filter(a=>ids.has(a.employeeId)&&kdate(a.start).startsWith(month)).sort((a,b)=>a.start<b.start?-1:1);
 const t=(iso:string|null)=>iso?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso)):'—';
 return <><Btn onClick={()=>setOn(true)}>출퇴근 기록 인쇄·PDF</Btn>{on&&createPortal(<div className="print-sheet" aria-hidden="true"><h1>{storeName} 출퇴근 기록 · {month.slice(0,4)}년 {Number(month.slice(5))}월</h1>{es.filter(e=>recs.some(r=>r.employeeId===e.id)).map(e=>{const mine=recs.filter(r=>r.employeeId===e.id),tot=mine.reduce((n,a)=>n+worked(a),0);return <section key={e.id}><h2>{e.name} · {e.role} · {mine.length}건 · 인정 {tot.toFixed(1)}시간</h2><table><thead><tr><th>날짜</th><th>출근</th><th>퇴근</th><th>휴게</th><th>인정 시간</th><th>찍은 시간</th><th>비고</th></tr></thead><tbody>{mine.map(a=><tr key={a.id}><td>{kdate(a.start).slice(5).replace('-','/')} ({W[new Date(kdate(a.start)+'T00:00:00Z').getUTCDay()]})</td><td>{t(a.start)}</td><td>{t(a.end)}</td><td>{a.breakMinutes}분</td><td>{worked(a).toFixed(2)}</td><td>{workedRaw(a).toFixed(2)}</td><td>{(a as any).source==='owner'?'사장님 입력':''}{(a as any).credit?' 인정 규칙 적용':''}</td></tr>)}</tbody></table></section>})}<p>출력일 {new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · 근로기준법 제42조에 따라 3년 보존</p></div>,document.body)}</>;
}
