'use client';
// 지시서 087: 다른 서비스에서 쓰던 기록 가져오기(출퇴근·근무표·지난 급여) — 엑셀(.xlsx)·CSV
import {useState} from 'react';
import {type Team,won} from '../lib/team-model';
import {readXlsx,readCsv} from '../lib/xlsx-read';
import {parseHistory,type HistoryMapping} from '../lib/history-import';

type Preview=ReturnType<typeof parseHistory>&{rows:string[][];mapping:HistoryMapping;file:string};

export function HistoryImport({s,busy,update,mutate,demo}:{s:Team,busy:boolean,update:(n:Team,close?:boolean)=>Promise<any>,mutate:(b:any,method?:string,close?:boolean)=>Promise<boolean>,demo:boolean}){
 const [p,setP]=useState<Preview|null>(null),[msg,setMsg]=useState(''),[err,setErr]=useState('');
 const employees=s.employees.map(e=>({...e,branchName:s.branches.find(b=>b.id===e.branchId)?.name||''}));
 const employeeLabel=(id:string)=>{const e=employees.find(e=>e.id===id);return e?`${e.name} · ${e.branchName||'매장 미지정'} · ID ${e.id}`:'등록되지 않은 직원'};
 const read=async(f:File)=>{setMsg('');setErr('');setP(null);try{const rows=/\.xlsx$/i.test(f.name)?await readXlsx(await f.arrayBuffer()):readCsv(await f.text());setP({...parseHistory(rows,employees),rows,mapping:{},file:f.name})}catch(e){setErr((e as Error).message||'파일을 읽지 못했어요. 엑셀(.xlsx)이나 CSV로 저장해 다시 골라 주세요.')}};
 const connect=(line:number,value:string)=>{if(!p||!value)return;const mapping={...p.mapping,[line]:value==='__exclude__'?null:value};setP({...p,...parseHistory(p.rows,employees,mapping),mapping});setErr('')};
 const go=async()=>{if(busy||!p?.kind||!p.items.length||p.unmatched.length)return;
  const fresh=parseHistory(p.rows,employees,p.mapping);
  if(fresh.unmatched.length||JSON.stringify(fresh.items)!==JSON.stringify(p.items)){setP({...p,...fresh});setErr('직원 정보가 바뀌었어요. 아래 연결과 미리보기를 다시 확인한 뒤 가져와 주세요.');return}
  if(p.kind==='출퇴근'){if(demo){setErr('체험 화면에서는 출퇴근 기록을 가져올 수 없어요. 내 가게에서 이용해 주세요.');return}if(await mutate({action:'importAttendance',items:p.items,source:p.file},'POST',false)){setMsg(`출퇴근 기록을 가져왔어요. 겹치거나 확정된 달의 기록은 건너뛰었어요. 변경 이력에 '데이터 가져오기'로 남아요.`);setP(null)}return}
  if(p.kind==='근무표'){const key=(x:any)=>x.employeeId+x.date+x.start,have=new Set(s.shifts.map(key)),add=p.items.filter(x=>!have.has(key(x))).map(x=>({id:crypto.randomUUID(),...x}));if(!add.length){setErr('이미 있는 근무예요. 새로 넣을 근무가 없어요.');return}if(await update({...s,shifts:[...s.shifts,...add]},false)){setMsg(`근무 ${add.length}개를 넣었어요${p.items.length-add.length?` (이미 있는 ${p.items.length-add.length}개는 건너뜀)`:''}.`);setP(null)}return}
  const cur:any[]=(s as any).importedPay||[],keyp=(x:any)=>x.employeeId+x.month,newKeys=new Set(p.items.map(keyp));
  if(await update({...s,importedPay:[...cur.filter(x=>!newKeys.has(keyp(x))),...p.items.map(x=>({...x,source:p.file.slice(0,60)}))]} as any,false)){setMsg(`지난 급여 ${p.items.length}건을 넣었어요. 연간 내역·퇴직금 확인 때 참고 자료로 보여요.`);setP(null)}};
 const imported:any[]=(s as any).importedPay||[];
 return <section className="panel t-gap hist-import" aria-labelledby="hi-title"><div className="panel-heading"><h2 id="hi-title">다른 서비스 기록 가져오기</h2></div><div className="t-panelbody">
  <p className="footnote">쓰던 앱·엑셀에서 받은 파일의 첫 줄에 제목을 맞춰 주세요. <b>출퇴근</b>: 이름·날짜·출근·퇴근·휴게(분) · <b>근무표</b>: 이름·날짜·시작·끝·휴게 · <b>지난 급여</b>: 이름·급여월·총지급·공제·실수령. 이름 대신 <b>직원 ID</b>를 쓸 수 있고, <b>매장</b> 열로 동명이인을 구분할 수 있어요. 자동으로 구분할 수 없는 줄은 직접 연결해요.</p>
  <label className="sd-file">파일 고르기(.xlsx·.csv)<input type="file" disabled={busy} accept=".xlsx,.csv,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void read(f)}}/></label>
  {p&&<div className="hi-preview"><p role="status"><b>{p.file}</b> · {p.kind?`${p.kind} ${p.items.length}건을 찾았어요`:'종류를 알아내지 못했어요'}{p.excluded.length>0&&` · 직접 제외한 줄 ${p.excluded.length}개`}</p>
   {p.unmatched.length>0&&<div className="hi-matching"><h3>직원 연결을 확인해 주세요 · {p.unmatched.length}줄</h3><p className="footnote">같은 이름만으로 고르지 않아요. 각 줄의 직원을 선택하거나, 이번에 가져오지 않을 줄을 제외해 주세요. 모두 확인해야 가져올 수 있어요.</p>{p.unmatched.slice(0,30).map(row=><div className="hi-match-row" key={row.line}><p><b>{row.line}줄 · {row.name||'이름 없음'}</b>{row.branch&&` · ${row.branch}`}{row.fileEmployeeId&&` · 파일 ID ${row.fileEmployeeId}`}<br/>{row.reason}</p><dl className="hi-original" aria-label="파일 원본 내용">{row.cells.map((cell,index)=><div key={index}><dt>{cell.title}</dt><dd>{cell.value||'(빈 칸)'}</dd></div>)}</dl><label>이 줄의 직원<select aria-label={`${row.line}줄 직원 연결`} value="" disabled={busy} onChange={e=>connect(row.line,e.target.value)}><option value="">직원을 직접 선택해 주세요</option>{[...employees].sort((a,b)=>Number(row.candidates.includes(b.id))-Number(row.candidates.includes(a.id))).map(e=><option key={e.id} value={e.id}>{employeeLabel(e.id)}</option>)}<option value="__exclude__">이 줄은 가져오지 않기</option></select></label></div>)}{p.unmatched.length>30&&<p className="footnote">위 30줄을 확인하면 나머지 줄이 이어서 보여요.</p>}</div>}
   {Object.keys(p.mapping).length>0&&<button type="button" className="secondary" disabled={busy} onClick={()=>{setP({...p,...parseHistory(p.rows,employees),mapping:{}});setErr('')}}>직접 연결·제외 초기화</button>}
   {p.items.length>0&&<ul className="hi-sample">{p.items.slice(0,5).map((x,i)=><li key={i}>{employeeLabel(x.employeeId)} · {p.kind==='지난 급여'?`${x.month} 총지급 ${won(x.gross)}원 · 실수령 ${won(x.net)}원`:`${x.date} ${x.start}–${x.end}${x.breakMinutes?` · 휴게 ${x.breakMinutes}분`:''}`}</li>)}{p.items.length>5&&<li>… 외 {p.items.length-5}건</li>}</ul>}
   {p.problems.length>0&&<details><summary>못 읽은 줄 {p.problems.length}개</summary><ul>{p.problems.slice(0,30).map((x,i)=><li key={i}>{x}</li>)}</ul></details>}
   <div className="actions"><button type="button" className="secondary" disabled={busy} onClick={()=>setP(null)}>취소</button><button type="button" className="primary" disabled={busy||!p.kind||!p.items.length||p.unmatched.length>0} onClick={go}>{p.unmatched.length?`직원 연결 ${p.unmatched.length}줄 확인 필요`:`${p.items.length}건 가져오기`}</button></div></div>}
  {msg&&<p role="status" className="saas-success">{msg}</p>}{err&&<p role="alert" className="saas-error">{err}</p>}
  {imported.length>0&&<p className="footnote">가져온 지난 급여 {imported.length}건 · {[...new Set(imported.map(x=>x.month))].sort()[0]} ~ {[...new Set(imported.map(x=>x.month))].sort().at(-1)}</p>}
 </div></section>;
}
