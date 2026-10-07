'use client';
// 지시서 087: 다른 서비스에서 쓰던 기록 가져오기(출퇴근·근무표·지난 급여) — 엑셀(.xlsx)·CSV
import {useState} from 'react';
import {type Team,won} from '../lib/team-model';
import {readXlsx,readCsv} from '../lib/xlsx-read';
import {parseHistory,type Kind} from '../lib/history-import';

export function HistoryImport({s,busy,update,mutate,demo}:{s:Team,busy:boolean,update:(n:Team,close?:boolean)=>Promise<any>,mutate:(b:any,method?:string,close?:boolean)=>Promise<boolean>,demo:boolean}){
 const [p,setP]=useState<{kind:Kind|null,items:any[],problems:string[],file:string}|null>(null),[msg,setMsg]=useState(''),[err,setErr]=useState('');
 const read=async(f:File)=>{setMsg('');setErr('');try{const rows=/\.xlsx$/i.test(f.name)?await readXlsx(await f.arrayBuffer()):readCsv(await f.text());setP({...parseHistory(rows,s.employees),file:f.name})}catch(e){setErr((e as Error).message||'파일을 읽지 못했어요. 엑셀(.xlsx)이나 CSV로 저장해 다시 골라 주세요.')}};
 const go=async()=>{if(!p?.kind||!p.items.length)return;
  if(p.kind==='출퇴근'){if(demo){setErr('체험 화면에서는 출퇴근 기록을 가져올 수 없어요. 내 가게에서 이용해 주세요.');return}if(await mutate({action:'importAttendance',items:p.items,source:p.file},'POST',false)){setMsg(`출퇴근 기록을 가져왔어요. 겹치거나 확정된 달의 기록은 건너뛰었어요. 변경 이력에 '데이터 가져오기'로 남아요.`);setP(null)}return}
  if(p.kind==='근무표'){const key=(x:any)=>x.employeeId+x.date+x.start,have=new Set(s.shifts.map(key)),add=p.items.filter(x=>!have.has(key(x))).map(x=>({id:crypto.randomUUID(),...x}));if(!add.length){setErr('이미 있는 근무예요. 새로 넣을 근무가 없어요.');return}if(await update({...s,shifts:[...s.shifts,...add]},false)){setMsg(`근무 ${add.length}개를 넣었어요${p.items.length-add.length?` (이미 있는 ${p.items.length-add.length}개는 건너뜀)`:''}.`);setP(null)}return}
  const cur:any[]=(s as any).importedPay||[],keyp=(x:any)=>x.employeeId+x.month,newKeys=new Set(p.items.map(keyp));
  if(await update({...s,importedPay:[...cur.filter(x=>!newKeys.has(keyp(x))),...p.items.map(x=>({...x,source:p.file.slice(0,60)}))]} as any,false)){setMsg(`지난 급여 ${p.items.length}건을 넣었어요. 연간 내역·퇴직금 확인 때 참고 자료로 보여요.`);setP(null)}};
 const imported:any[]=(s as any).importedPay||[];
 return <section className="panel t-gap hist-import" aria-labelledby="hi-title"><div className="panel-heading"><h2 id="hi-title">다른 서비스 기록 가져오기</h2></div><div className="t-panelbody">
  <p className="footnote">쓰던 앱·엑셀에서 받은 파일의 첫 줄에 제목을 맞춰 주세요. <b>출퇴근</b>: 이름·날짜·출근·퇴근·휴게(분) · <b>근무표</b>: 이름·날짜·시작·끝·휴게 · <b>지난 급여</b>: 이름·급여월·총지급·공제·실수령. 직원은 먼저 등록해 두세요(이름으로 맞춰요).</p>
  <label className="sd-file">파일 고르기(.xlsx·.csv)<input type="file" accept=".xlsx,.csv,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void read(f)}}/></label>
  {p&&<div className="hi-preview" role="status"><p><b>{p.file}</b> · {p.kind?`${p.kind} ${p.items.length}건을 찾았어요`:'종류를 알아내지 못했어요'}</p>
   {p.items.length>0&&<ul className="hi-sample">{p.items.slice(0,5).map((x,i)=><li key={i}>{s.employees.find(e=>e.id===x.employeeId)?.name} · {p.kind==='지난 급여'?`${x.month} 총지급 ${won(x.gross)}원 · 실수령 ${won(x.net)}원`:`${x.date} ${x.start}–${x.end}${x.breakMinutes?` · 휴게 ${x.breakMinutes}분`:''}`}</li>)}{p.items.length>5&&<li>… 외 {p.items.length-5}건</li>}</ul>}
   {p.problems.length>0&&<details><summary>못 읽은 줄 {p.problems.length}개</summary><ul>{p.problems.slice(0,30).map((x,i)=><li key={i}>{x}</li>)}</ul></details>}
   <div className="actions"><button type="button" className="secondary" onClick={()=>setP(null)}>취소</button><button type="button" className="primary" disabled={busy||!p.kind||!p.items.length} onClick={go}>{p.items.length}건 가져오기</button></div></div>}
  {msg&&<p role="status" className="saas-success">{msg}</p>}{err&&<p role="alert" className="saas-error">{err}</p>}
  {imported.length>0&&<p className="footnote">가져온 지난 급여 {imported.length}건 · {[...new Set(imported.map(x=>x.month))].sort()[0]} ~ {[...new Set(imported.map(x=>x.month))].sort().at(-1)}</p>}
 </div></section>;
}
