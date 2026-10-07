'use client';
// 지시서 '다음' 근무표 묶음: 027 짜는 동안 예상 인건비 · 028 빈 근무 공개 모집(선착순) · 029 주간·일간 공휴일·휴무일 표시
import {useState} from 'react';
import {type Team,datePlus,duration,won} from '../lib/team-model';
import {PUBLIC_HOLIDAYS} from '../lib/holidays';

const md=(d:string)=>`${Number(d.slice(5,7))}/${Number(d.slice(8))}`;
const W='일월화수목금토';

/** 029: 그날 공휴일 이름과 매장 정기 휴무 여부 */
export function dayMark(s:Team,branch:string,d:string){
 const hol=(PUBLIC_HOLIDAYS[Number(d.slice(0,4))]||[]).find(([x])=>x===d)?.[1];
 const closed=!!(s.branches.find(b=>b.id===branch) as any)?.closedDays?.includes(new Date(d+'T00:00:00Z').getUTCDay());
 return {hol,closed};
}
export function DayMarks({s,branch,d}:{s:Team,branch:string,d:string}){
 const {hol,closed}=dayMark(s,branch,d);
 return <>{hol&&<small className="t-hol">공휴일 · {hol}</small>}{closed&&<small className="t-closed">정기 휴무</small>}</>;
}

/** 027: 보고 있는 기간 근무표 기준 예상 인건비(저장할 때마다 바로 다시 계산) */
export function plannedCost(s:Team,es:Team['employees'],from:string,to:string){
 const ids=new Set(es.map(e=>e.id)),list=s.shifts.filter(x=>ids.has(x.employeeId)&&x.date>=from&&x.date<=to);
 let cost=0,hours=0,holiday=0;const monthly=new Set<string>();const week:Record<string,number>={};
 for(const x of list){const e=es.find(e=>e.id===x.employeeId)!,h=duration(x.start,x.end,x.breakMinutes);hours+=h;
  if(e.payType==='시급'){cost+=h*e.wage;week[e.id]=(week[e.id]||0)+h}
  else if(e.payType==='일급'){if(list.find(y=>y.employeeId===x.employeeId&&y.date===x.date)?.id===x.id)cost+=e.wage}
  else monthly.add(e.id)}
 // 주휴수당 예상: 이 기간이 한 주일 때만(시급 직원, 주 15시간 이상) 시간 ÷ 40 × 8 × 시급
 const oneWeek=Date.parse(to)-Date.parse(from)===6*86400000;
 if(oneWeek)for(const [id,h] of Object.entries(week))if(h>=15){const e=es.find(e=>e.id===id)!;holiday+=Math.min(h,40)/40*8*e.wage}
 return {cost:Math.round(cost+holiday),hours:Math.round(hours*10)/10,holiday:Math.round(holiday),monthly:monthly.size,count:list.length};
}
export function LiveCost({s,es,from,to,label}:{s:Team,es:Team['employees'],from:string,to:string,label:string}){
 const c=plannedCost(s,es,from,to);if(!c.count)return null;
 const budget=(s.settings as any).laborBudget as number|undefined;
 return <p className="live-cost" role="status" aria-live="polite"><b>{label} 예상 인건비 {won(c.cost)}원</b> · 근무 {c.hours}시간{c.holiday?` · 주휴 예상 ${won(c.holiday)}원 포함`:''}{c.monthly?` · 월급 직원 ${c.monthly}명은 빼고 셈`:''}{budget&&from.slice(0,7)===to.slice(0,7)&&to.slice(8)>='28'?` · 예산 ${won(budget)}원`:''}<small>근무표 기준 세전 금액이에요. 연장·야간 가산과 4대보험 사업주 부담은 빠져 있어요.</small></p>;
}

type Open=NonNullable<any>&{id:string,branchId:string,date:string,start:string,end:string,breakMinutes:number,position?:string,note?:string,status:'모집 중'|'배정됨'|'취소',createdAt:string,assignedTo?:string,assignedAt?:string};

/** 028 사장님: 사람 없이 근무만 올려 두면 같은 매장 직원 중 먼저 누른 사람이 맡는다 */
export function OpenShiftsOwner({s,es,branch,date,busy,save}:{s:Team,es:Team['employees'],branch:string,date:string,busy:boolean,save:(n:Team)=>Promise<any>}){
 const list:Open[]=((s as any).openShifts||[]).filter((o:Open)=>o.branchId===branch&&o.status!=='취소'&&o.date>=datePlus(date,-7)).sort((a:Open,b:Open)=>(a.date+a.start).localeCompare(b.date+b.start));
 const [f,setF]=useState<any>(null),[msg,setMsg]=useState('');
 const name=(id?:string)=>es.find(e=>e.id===id)?.name||'직원';
 const post=async()=>{const o:Open={id:crypto.randomUUID(),branchId:branch,date:f.date,start:f.start,end:f.end,breakMinutes:Number(f.breakMinutes)||0,...(f.position?{position:f.position}:{}),...(f.note?{note:f.note}:{}),status:'모집 중',createdAt:new Date().toISOString()};
  if(o.start===o.end){setMsg('시작과 끝 시간을 다르게 정해 주세요.');return}
  if(await save({...s,openShifts:[...((s as any).openShifts||[]),o].slice(-500)} as any)){setF(null);setMsg(`${md(o.date)} ${o.start}–${o.end} 빈 근무를 올렸어요. 매장 직원에게 알림이 가요.`)}};
 const cancel=async(o:Open)=>{if(await save({...s,openShifts:((s as any).openShifts||[]).map((x:Open)=>x.id===o.id?{...x,status:'취소'}:x)} as any))setMsg('모집을 내렸어요.')};
 return <section className="panel t-gap open-shifts" aria-labelledby="os-title"><div className="panel-heading"><h2 id="os-title">빈 근무 모집 {list.filter(o=>o.status==='모집 중').length?`· ${list.filter(o=>o.status==='모집 중').length}건 모집 중`:''}</h2><button type="button" className="secondary" onClick={()=>{setMsg('');setF({date,start:'10:00',end:'15:00',breakMinutes:30,position:'',note:''})}}>+ 빈 근무 올리기</button></div>
  <div className="t-panelbody">
   {f&&<form className="os-form" onSubmit={e=>{e.preventDefault();void post()}}><div className="t-formgrid">
    <label>날짜 <input type="date" required value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></label>
    <label>시작 <input type="time" required value={f.start} onChange={e=>setF({...f,start:e.target.value})}/></label>
    <label>끝 <input type="time" required value={f.end} onChange={e=>setF({...f,end:e.target.value})}/></label>
    <label>휴게(분) <input type="number" min={0} max={480} value={f.breakMinutes} onChange={e=>setF({...f,breakMinutes:e.target.value})}/></label>
    <label>포지션(선택) <input maxLength={20} value={f.position} onChange={e=>setF({...f,position:e.target.value})} placeholder="예: 주방"/></label>
    <label>메모(선택) <input maxLength={200} value={f.note} onChange={e=>setF({...f,note:e.target.value})} placeholder="예: 마감 청소 포함"/></label></div>
    <p className="footnote">먼저 '맡을게요'를 누른 직원에게 바로 들어가요. 그 직원 근무와 겹치거나 연소자 제한에 걸리면 맡을 수 없어요.</p>
    <div className="actions"><button type="button" className="secondary" onClick={()=>setF(null)}>취소</button><button type="submit" className="primary" disabled={busy}>올리고 알리기</button></div></form>}
   {msg&&<p role="status" className="saas-success">{msg}</p>}
   {list.length?<ul className="os-list">{list.map(o=><li key={o.id}><b>{md(o.date)}({W[new Date(o.date+'T00:00:00Z').getUTCDay()]}) {o.start}–{o.end}</b>{o.position&&<span> · {o.position}</span>}{o.note&&<small> · {o.note}</small>} {o.status==='배정됨'?<span className="os-done">✓ {name(o.assignedTo)}님이 맡음</span>:<><span className="os-wait">모집 중</span> <button type="button" className="link-btn" disabled={busy} onClick={()=>cancel(o)}>모집 내리기</button></>}</li>)}</ul>:!f&&<p className="footnote">대타가 필요한 시간을 사람 없이 올려 두면, 같은 매장 직원이 보고 먼저 맡을 수 있어요.</p>}
  </div></section>;
}

/** 028 직원: 내 매장 빈 근무 보고 맡기 */
export function OpenShiftsStaff({state,selfId,busy,mutate,today}:{state:Team,selfId:string,busy:boolean,mutate:(b:any)=>Promise<boolean>,today:string}){
 const list:Open[]=((state as any).openShifts||[]).filter((o:Open)=>o.status==='모집 중'&&o.date>=today).sort((a:Open,b:Open)=>(a.date+a.start).localeCompare(b.date+b.start));
 const mine:Open[]=((state as any).openShifts||[]).filter((o:Open)=>o.assignedTo===selfId&&o.date>=today);
 if(!list.length&&!mine.length)return null;
 return <section className="panel t-gap open-shifts" aria-labelledby="oss-title"><div className="panel-heading"><h2 id="oss-title">빈 근무 모집 {list.length}건</h2></div><div className="t-panelbody">
  <ul className="os-list">{list.map(o=><li key={o.id}><b>{md(o.date)}({W[new Date(o.date+'T00:00:00Z').getUTCDay()]}) {o.start}–{o.end}</b> · {duration(o.start,o.end,o.breakMinutes).toFixed(1)}시간{o.position&&<span> · {o.position}</span>}{o.note&&<small> · {o.note}</small>} <button type="button" className="primary" disabled={busy} onClick={()=>mutate({action:'takeOpenShift',id:o.id})}>맡을게요</button></li>)}
   {mine.map(o=><li key={o.id}><span className="os-done">✓ 내가 맡음</span> {md(o.date)} {o.start}–{o.end}</li>)}</ul>
  <p className="footnote">먼저 누른 사람이 맡아요. 누르면 바로 내 근무표에 들어가요.</p></div></section>;
}
