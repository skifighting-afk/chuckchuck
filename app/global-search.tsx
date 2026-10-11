'use client';
// 지시서 136: 어느 화면에서든 직원 이름으로 찾기 → 그 직원의 정보·근무표·출퇴근·급여로 바로 가기
import {useRef,useState} from 'react';
import {type Team} from '../lib/team-model';
export function GlobalSearch({s,go}:{s:Team,go:(where:'info'|'schedule'|'attendance'|'payroll',e:Team['employees'][number])=>void}){
 const [q,setQ]=useState(''),[open,setOpen]=useState(false),input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null),t=q.trim();
 const close=()=>{setQ('');setOpen(false);if(matchMedia('(max-width: 767px)').matches)requestAnimationFrame(()=>trigger.current?.focus())};
 const hits=t?s.employees.filter(e=>e.name.includes(t)||(e.phone||'').replace(/\D/g,'').endsWith(t.replace(/\D/g,''))&&t.replace(/\D/g,'').length>=4).slice(0,6):[];
 const bname=(id:string)=>s.branches.find(b=>b.id===id)?.name||'';
 return <div className={'gsearch'+(open?' search-open':'')} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();close()}}}><button ref={trigger} type="button" className="gsearch-trigger" aria-expanded={open} aria-controls="global-employee-search" onClick={()=>{if(open)close();else{setOpen(true);requestAnimationFrame(()=>input.current?.focus())}}}>직원 찾기{open?' 닫기':''}</button><input ref={input} id="global-employee-search" type="search" aria-label="직원 이름으로 찾기" placeholder="직원 찾기" value={q} onChange={e=>setQ(e.target.value)}/>
  {t&&<div className="gsearch-pop" role="listbox" aria-label="찾은 직원">{hits.length?hits.map(e=><div key={e.id} className="gs-item"><b>{e.name}</b><small>{e.role} · {e.status}{s.branches.length>1?' · '+bname(e.branchId):''}</small><div>{([['info','정보'],['schedule','근무표'],['attendance','출퇴근'],['payroll','급여']] as const).map(([k,l])=><button key={k} type="button" onClick={()=>{close();go(k,e)}}>{l}</button>)}</div></div>):<p>'{t}' 직원이 없어요.</p>}</div>}
 </div>;
}
