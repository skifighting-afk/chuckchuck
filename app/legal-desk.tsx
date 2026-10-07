'use client';
// 지시서 128 서식함 · 129 법정 의무교육 체크
import {useState} from 'react';
import {type Team,today} from '../lib/team-model';
import {FORM_KINDS,formText,type FormKind} from '../lib/forms';
import {trainingStatus} from '../lib/trainings';

export function FormsBox({s,es,openDoc}:{s:Team,es:Team['employees'],openDoc:(title:string,text:string)=>void}){
 const [kind,setKind]=useState<FormKind>('주의·경고 통지서'),[emp,setEmp]=useState(es[0]?.id||'');
 const e=es.find(x=>x.id===emp);const b=s.branches.find(x=>x.id===e?.branchId);
 return <section className="panel t-gap forms-box" aria-label="서식함"><div className="panel-heading"><h2>서식함</h2></div><div className="t-panelbody">
  <p className="footnote">자주 쓰는 노무 서식이에요. 빈칸 [ ]을 채워 출력하거나 내려받아 쓰세요. 해고·징계는 정당한 이유와 절차가 필요하니 보내기 전에 노무사와 상의하세요.</p>
  <div className="t-inline fb-row"><label>서식<select value={kind} onChange={v=>setKind(v.target.value as FormKind)}>{FORM_KINDS.map(k=><option key={k}>{k}</option>)}</select></label><label>직원<select value={emp} onChange={v=>setEmp(v.target.value)}>{es.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button type="button" className="primary" disabled={!e} onClick={()=>e&&openDoc(kind+' · '+e.name,formText(kind,{store:s.store.name+(b&&s.branches.length>1?' '+b.name:''),owner:s.settings.employerName,address:b?.address},e as any,today()))}>서식 열기</button></div>
 </div></section>;
}
export function TrainingDesk({s,es,busy,save}:{s:Team,es:Team['employees'],busy:boolean,save:(n:Team)=>Promise<any>}){
 const year=Number(today().slice(0,4)),active=es.filter(e=>e.status!=='퇴사'),recs:any[]=(s as any).trainings||[];
 const st=trainingStatus(recs,year,s.employees.filter(e=>e.status!=='퇴사').length,active.map(e=>e.id),!!(s.settings as any).retirementPension);
 const [f,setF]=useState<any>(null);
 const name=(id:string)=>es.find(e=>e.id===id)?.name||'';
 return <section className="panel t-gap training" aria-label="법정 의무교육"><div className="panel-heading"><h2>{year}년 법정 의무교육</h2></div><div className="t-panelbody">
  <ul>{st.map(t=><li key={t.kind}><span className={'pc-level '+(t.done?'info':'need')}>{t.done?'이수':'아직'}</span> <b>{t.kind}</b> · {t.when} · {t.who}{t.done&&<small>마지막 {t.last}{t.missing.length?` · 안 들은 직원: ${t.missing.map(name).join(', ')}`:' · 모두 들음'}</small>}<small>{t.note}</small><button type="button" className="secondary" onClick={()=>setF({kind:t.kind,date:today(),attendees:active.map(e=>e.id),note:''})}>이수 기록</button></li>)}</ul>
  {f&&<form className="tr-form" onSubmit={async e=>{e.preventDefault();if(await save({...s,trainings:[...recs,{id:crypto.randomUUID(),...f}].slice(-500)} as any))setF(null)}}><b>{f.kind} 이수 기록</b><label>날짜<input type="date" required value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></label><fieldset><legend>들은 직원</legend>{active.map(x=><label key={x.id} className="t-check"><input type="checkbox" checked={f.attendees.includes(x.id)} onChange={e=>setF({...f,attendees:e.target.checked?[...f.attendees,x.id]:f.attendees.filter((i:string)=>i!==x.id)})}/> {x.name}</label>)}</fieldset><label>메모(교육 방법·자료)<input maxLength={300} value={f.note} onChange={e=>setF({...f,note:e.target.value})} placeholder="예: 고용노동부 영상 시청 후 서명"/></label><div className="actions"><button type="button" className="secondary" onClick={()=>setF(null)}>그만두기</button><button className="primary" disabled={busy}>저장</button></div></form>}
  <p className="footnote">기준은 법이 바뀌면 달라질 수 있어요. 근로감독 때 교육 자료·참석 서명을 함께 보여 줘야 하니 따로 보관해 주세요.</p>
 </div></section>;
}
