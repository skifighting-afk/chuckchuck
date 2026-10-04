'use client';
// 작업 053: 근무표 A4 가로 인쇄
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {type Team,type Member,datePlus,duration} from '../lib/team-model';
import {Btn} from './team-ui';
const W=['일','월','화','수','목','금','토'];
export function PrintSchedule({s,es,week,storeName}:{s:Team,es:Member[],week:string,storeName:string}){
 const [on,setOn]=useState(false);
 useEffect(()=>{if(!on)return;const done=()=>setOn(false);window.addEventListener('afterprint',done);const t=setTimeout(()=>window.print(),50);return()=>{clearTimeout(t);window.removeEventListener('afterprint',done)}},[on]);
 const days=Array.from({length:7},(_,i)=>datePlus(week,i)),people=es.filter(e=>e.status!=='퇴사');
 const cell=(id:string,d:string)=>s.shifts.filter(x=>x.employeeId===id&&x.date===d).sort((a,b)=>a.start<b.start?-1:1);
 const hours=(id:string)=>s.shifts.filter(x=>x.employeeId===id&&x.date>=days[0]&&x.date<=days[6]).reduce((n,x)=>n+duration(x.start,x.end,x.breakMinutes),0);
 return <><Btn onClick={()=>setOn(true)}>인쇄 (A4 가로)</Btn>{on&&createPortal(<div className="print-sheet" aria-hidden="true"><h1>{storeName} 근무표 · {days[0]} ~ {days[6]}</h1><table><thead><tr><th>직원</th>{days.map(d=><th key={d}>{Number(d.slice(5,7))}/{Number(d.slice(8))} ({W[new Date(d+'T00:00:00Z').getUTCDay()]})</th>)}<th>주 합계</th></tr></thead><tbody>{people.map(e=><tr key={e.id}><th>{e.name}<small>{e.role}</small></th>{days.map(d=><td key={d}>{cell(e.id,d).map(x=><div key={x.id}>{x.start}~{x.end}{x.breakMinutes?<small> 휴게 {x.breakMinutes}분</small>:null}</div>)}</td>)}<td>{hours(e.id).toFixed(1)}시간</td></tr>)}</tbody></table><p>출력 {new Date().toLocaleString('ko-KR')} · 척척사장봇</p></div>,document.body)}</>
}
