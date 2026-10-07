'use client';
// 지시서 11주차: 계정·데이터 — 보존 기간 지난 퇴사자 연락처 지우기(사장님), 내 자료 내려받기(직원)
import {useState} from 'react';
import {type Team,today} from '../lib/team-model';
import {retentionDue,anonymize,myDataExport,RETAIN_YEARS} from '../lib/retention';

export function RetentionPanel({s,busy,save}:{s:Team,busy:boolean,save:(n:Team)=>Promise<any>}){
 const due=retentionDue(s.employees as any,today()),[pick,setPick]=useState<string[]>([]),[msg,setMsg]=useState('');
 const run=async()=>{if(!pick.length)return;if(!confirm(`${pick.length}명의 연락처·주소·비상연락처·메모를 지울까요? 되돌릴 수 없어요.`))return;const at=new Date().toISOString();if(await save({...s,employees:s.employees.map(e=>pick.includes(e.id)?anonymize(e as any,at):e)} as any)){setMsg(`${pick.length}명의 개인정보를 지웠어요.`);setPick([])}};
 return <section className="panel t-gap retention" aria-label="개인정보 보존 기간"><div className="panel-heading"><h2>개인정보 보존 기간</h2></div><div className="t-panelbody">
  <p>근로자 명부·근로계약서·임금 기록은 퇴사 뒤 {RETAIN_YEARS}년 보관해야 해요(근로기준법 제42조). 기간이 지나면 연락처는 지워 주세요. 이름은 가려서 남기고 지난 급여 기록은 그대로 둬요.</p>
  {due.length?<><ul>{due.map(e=><li key={e.id}><label className="t-check"><input type="checkbox" checked={pick.includes(e.id)} onChange={ev=>setPick(ev.target.checked?[...pick,e.id]:pick.filter(x=>x!==e.id))}/> <b>{e.name}</b> · 퇴사 {e.endDate||'날짜 없음(입사일 기준)'}</label></li>)}</ul>
   <button type="button" className="primary" disabled={busy||!pick.length} onClick={run}>고른 {pick.length}명 연락처 지우기</button></>:<p className="pc-ok">✓ 보존 기간이 지난 퇴사자가 없어요.</p>}
  {msg&&<p className="saas-success" role="status">{msg}</p>}
 </div></section>;
}
export function MyDataDownload({state,selfId}:{state:Team,selfId:string}){
 const go=()=>{const d=myDataExport(state,selfId,new Date().toISOString());if(!d)return;const url=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`내자료-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 return <section className="panel t-gap my-data" aria-label="내 자료 내려받기"><div className="panel-heading"><h2>내 자료 내려받기</h2></div><div className="t-panelbody"><p>척척사장에 저장된 내 정보·근무표·출퇴근 기록·확정된 급여를 한 파일로 받아요. 이 화면에 보이는 기간만 담겨요.</p><button type="button" className="secondary" onClick={go}>내 자료 받기</button></div></section>;
}
