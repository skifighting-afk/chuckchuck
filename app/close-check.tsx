'use client';
// 작업 096 오늘 할 일 · 작업 097 월말 마감 체크리스트 화면
import {useEffect,useState} from 'react';
import {type Team} from '../lib/team-model';
import {todayTasks,monthChecklist,type Target} from '../lib/close-check';
export const TARGET_PAGE:Record<Target,string>={attendance:'출퇴근 기록',employees:'직원 관리',operations:'휴가·공지',contracts:'근로계약서',payroll:'급여·명세서',schedule:'근무 스케줄'};
function useOps(skip=false){const [ops,setOps]=useState<any>(null);useEffect(()=>{if(skip)return;fetch('/api/operations').then(r=>r.ok?r.json():null).then(setOps).catch(()=>{})},[]);return ops}
export function TodayTasks({s,branch,today,go,demo}:{s:Team,branch:string,today:string,go:(t:Target)=>void,demo?:boolean}){
 const ops=useOps(!!demo),[docs,setDocs]=useState<any[]|null>(null);
 useEffect(()=>{if(!demo)fetch('/api/documents').then(r=>r.ok?r.json():null).then((d:any)=>setDocs(d?.documents||[])).catch(()=>{})},[]);
 const ids=new Set(s.employees.filter(e=>e.branchId===branch).map(e=>e.id));
 const pendingLeaves=ops?ops.leaves.filter((l:any)=>l.status==='승인 대기'&&ids.has(l.employeeId)).length:0,pendingSwaps=ops?(ops.swaps||[]).filter((w:any)=>w.status==='승인 대기'&&w.branchId===branch).length:0;
 // 확정된 급여 중 가장 최근 달에서 아직 명세서를 안 보낸 직원 수
 const runs=Object.entries(s.payrollRuns).filter(([k,r]:[string,any])=>r.locked&&k.endsWith(':'+branch)).sort((a,b)=>a[0]<b[0]?1:-1),latest:any=runs[0];
 const unsent=latest&&docs?latest[1].rows.filter((r:any)=>!docs.some(d=>d.run_key===latest[0]&&d.employee_id===r.employeeId&&d.state==='current')).length:0;
 const tasks=todayTasks(s,branch,today,{pendingLeaves,pendingSwaps,unsentPayslips:unsent});
 const total=tasks.reduce((n,t)=>n+t.count,0);
 return <section className="home-tasks today-tasks" aria-labelledby="today-tasks-title"><h2 id="today-tasks-title">오늘 할 일 <strong>{total}건</strong></h2>{tasks.length?<div className="home-task-list">{tasks.map(t=><button key={t.key} onClick={()=>go(t.target)}>{t.label} {t.count}{t.key==='contracts'||t.key==='ending'||t.key==='profile'||t.key==='payslips'?'명':'건'} <span>처리 →</span></button>)}</div>:<p>지금 처리할 일이 없어요. 👍</p>}</section>
}
export function MonthChecklist({s,branch,month,payDate,go}:{s:Team,branch:string,month:string,payDate?:string,go:(t:Target)=>void}){
 const ops=useOps(),ids=new Set(s.employees.filter(e=>e.branchId===branch).map(e=>e.id));
 const pendingLeavesInMonth=ops?ops.leaves.filter((l:any)=>l.status==='승인 대기'&&ids.has(l.employeeId)&&l.start.slice(0,7)<=month&&l.end.slice(0,7)>=month).length:0;
 const items=monthChecklist(s,branch,month,payDate,{pendingLeavesInMonth}),bad=items.filter(i=>!i.ok).length;
 return <section className="month-check" aria-labelledby="month-check-title"><h3 id="month-check-title">{month} 마감 전 확인 {bad?<span className="warn">{bad}개 확인 필요</span>:<span className="ok">모두 확인됨</span>}</h3><ul>{items.map(i=><li key={i.key} className={i.ok?'ok':'warn'}><span aria-hidden="true">{i.ok?'✓':'!'}</span><div><b>{i.label}</b><small>{i.detail}</small></div>{!i.ok&&i.key!=='paydate'&&<button className="link" onClick={()=>go(i.target)}>확인하러 가기</button>}</li>)}</ul></section>
}
