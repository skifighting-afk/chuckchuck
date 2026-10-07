'use client';
// 지시서 196: 출퇴근 정정 요청을 한 건씩 넘기며 승인·반려 · 017: 여러 건 골라 한 번에 승인
import {useState} from 'react';
import {type Team} from '../lib/team-model';
const t=(iso?:string|null)=>iso?new Date(iso).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
export function ReviewQueue({s,es,busy,mutate,onClose}:{s:Team,es:Team['employees'],busy:boolean,mutate:(b:any)=>Promise<boolean>,onClose:()=>void}){
 const ids=new Set(es.map(e=>e.id)),list=s.requests.filter(r=>r.status==='승인 대기'&&ids.has(r.before.employeeId)),[done,setDone]=useState(0),[bulk,setBulk]=useState(false),[pick,setPick]=useState<string[]>([]),[fails,setFails]=useState(0);
 const r=list[0];
 if(!r)return <div className="rq"><p className="pc-ok">✓ 처리할 정정 요청을 모두 끝냈어요{done?` (${done}건)`:''}.</p><button type="button" className="primary" onClick={onClose}>닫기</button></div>;
 const name=es.find(e=>e.id===r.before.employeeId)?.name||'직원',nm=(id:string)=>es.find(e=>e.id===id)?.name||'직원';
 const approveAll=async()=>{let ok=0,bad=0;for(const id of pick){if(await mutate({action:'review',id,approve:true}))ok++;else bad++}setDone(done+ok);setFails(bad);setPick([]);setBulk(false)};
 if(bulk)return <div className="rq"><p className="rq-count">승인할 요청을 골라 주세요 · {pick.length}/{list.length}건 고름</p>
  <label className="t-check"><input type="checkbox" checked={pick.length===list.length} onChange={e=>setPick(e.target.checked?list.map(x=>x.id):[])}/> 전부 고르기</label>
  <ul className="rq-list">{list.map(x=><li key={x.id}><label className="t-check"><input type="checkbox" checked={pick.includes(x.id)} onChange={e=>setPick(e.target.checked?[...pick,x.id]:pick.filter(v=>v!==x.id))}/> <b>{nm(x.before.employeeId)}</b> {t(x.before.start)}→{t(x.after.start)} · {t(x.before.end)}→{t(x.after.end)} <small>{x.reason||''}</small></label></li>)}</ul>
  <p className="footnote">한 건씩 차례로 승인해요. 시간이 겹치거나 확정된 달이면 그 건만 건너뛰고 남겨 둬요.</p>
  <div className="actions"><button type="button" className="secondary" onClick={()=>setBulk(false)}>한 건씩 보기</button><button type="button" className="primary" disabled={busy||!pick.length} onClick={approveAll}>{pick.length}건 승인</button></div></div>;
 const act=async(approve:boolean)=>{if(await mutate({action:'review',id:r.id,approve}))setDone(done+1)};
 return <div className="rq"><p className="rq-count">남은 요청 {list.length}건{done?` · 처리 ${done}건`:''}{fails?` · 건너뜀 ${fails}건`:''}{list.length>1&&<> <button type="button" className="att-link" onClick={()=>setBulk(true)}>여러 건 골라 한 번에 승인</button></>}</p>
  <article className="rq-card"><b>{name}</b><dl><div><dt>지금 기록</dt><dd>{t(r.before.start)} → {t(r.before.end)} · 휴게 {r.before.breakMinutes}분</dd></div><div><dt>바꿔 달라는 기록</dt><dd>{t(r.after.start)} → {t(r.after.end)} · 휴게 {r.after.breakMinutes}분</dd></div><div><dt>사유</dt><dd>{r.reason||'—'}</dd></div></dl></article>
  <div className="actions"><button type="button" className="secondary" disabled={busy} onClick={()=>act(false)}>반려</button><button type="button" className="primary" disabled={busy} onClick={()=>act(true)}>승인하고 다음</button></div></div>;
}
