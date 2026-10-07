'use client';
// 지시서 154 시급 일괄 인상(예약 가능) · 155 직원 여러 명 한 번에 수정(지점·업무·시급)
import {useState} from 'react';
import {type Team,today,won} from '../lib/team-model';
import {ratesFor} from '../lib/pay-rules';
import {planRaise,type RaiseMode} from '../lib/wage-raise';
export function BulkEdit({s,es,busy,save,onClose}:{s:Team,es:Team['employees'],busy:boolean,save:(n:Team)=>Promise<any>,onClose:()=>void}){
 const active=es.filter(e=>e.status!=='퇴사'),[ids,setIds]=useState<string[]>(active.filter(e=>e.payType==='시급').map(e=>e.id));
 const y=Number(today().slice(0,4)),nextMin=ratesFor(y+1).minimumWage,curMin=ratesFor(y).minimumWage;
 const [mode,setMode]=useState<'min'|'pct'|'add'|'set'|'none'>('min'),[val,setVal]=useState(String(nextMin>curMin?nextMin:curMin)),[from,setFrom]=useState(nextMin>curMin?`${y+1}-01-01`:today());
 const [branch,setBranch]=useState(''),[role,setRole]=useState(''),[err,setErr]=useState('');
 const m:RaiseMode|null=mode==='none'?null:mode==='min'?{kind:'min',to:Number(val)}:mode==='pct'?{kind:'pct',pct:Number(val)}:mode==='add'?{kind:'add',add:Number(val)}:{kind:'set',to:Number(val)};
 const preview=m?planRaise(active as any,ids,m,from,today()).changes:[];
 const run=async()=>{setErr('');if(!ids.length){setErr('바꿀 직원을 골라 주세요.');return}let emps:any[]=s.employees;if(m){if(!(Number(val)>0)){setErr('숫자를 넣어 주세요.');return}emps=planRaise(emps,ids,m,from,today(),'일괄 변경',new Date().toISOString()).employees}
  emps=emps.map(e=>ids.includes(e.id)?{...e,...(branch?{branchId:branch}:{}),...(role?{role}:{})}:e);if(await save({...s,employees:emps}))onClose()};
 const roles=[...new Set(['홀','주방','매니저',...s.employees.map(e=>e.role)])];
 return <div className="bulk-edit">
  <fieldset><legend>바꿀 직원 {ids.length}명</legend><button type="button" className="link-btn" onClick={()=>setIds(ids.length===active.length?[]:active.map(e=>e.id))}>{ids.length===active.length?'모두 빼기':'모두 고르기'}</button>{active.map(e=><label key={e.id} className="t-check"><input type="checkbox" checked={ids.includes(e.id)} onChange={v=>setIds(v.target.checked?[...ids,e.id]:ids.filter(x=>x!==e.id))}/> {e.name} <small>{e.payType} {won(e.wage)}원</small></label>)}</fieldset>
  <fieldset><legend>급여</legend><select value={mode} onChange={e=>setMode(e.target.value as any)} aria-label="급여 바꾸는 방법"><option value="none">급여는 그대로</option><option value="min">최저시급 이상으로 맞추기</option><option value="pct">%로 올리기</option><option value="add">금액 더하기</option><option value="set">같은 금액으로</option></select>
   {mode!=='none'&&<><label>{mode==='pct'?'올릴 %':mode==='add'?'더할 금액(원)':'금액(원)'}<input inputMode="numeric" value={val} onChange={e=>setVal(e.target.value.replace(/[^\d.]/g,''))}/></label><label>언제부터<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><small>{from>today()?`${from}에 자동으로 바뀌어요(예약). 그 전 근무는 지금 금액으로 계산해요.`:'바로 바뀌어요. 이 날 이후 근무부터 새 금액으로 계산해요.'} {nextMin>curMin&&`${y+1}년 최저시급은 ${won(nextMin)}원이에요.`}</small></>}</fieldset>
  <fieldset><legend>소속·업무</legend><label>지점<select value={branch} onChange={e=>setBranch(e.target.value)}><option value="">그대로</option>{s.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>업무<select value={role} onChange={e=>setRole(e.target.value)}><option value="">그대로</option>{roles.map(r=><option key={r}>{r}</option>)}</select></label></fieldset>
  {preview.length>0&&<div className="notice"><b>바뀌는 급여 {preview.length}명</b><ul>{preview.map(c=><li key={c.id}>{c.name}: {won(c.prev)}원 → {won(c.next)}원</li>)}</ul></div>}
  {err&&<p className="saas-error" role="alert">{err}</p>}
  <div className="actions"><button type="button" className="secondary" onClick={onClose}>닫기</button><button type="button" className="primary" disabled={busy} onClick={run}>{ids.length}명 바꾸기</button></div>
 </div>;
}
