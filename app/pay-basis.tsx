'use client';
// 작업 031: 급여 각 줄의 계산 근거와, 그 금액에 들어간 출퇴근 기록
import {useState} from 'react';
import {type Team,kdate,clock,worked,won} from '../lib/team-model';
export function PayBasis({s,row,month}:{s:Team,row:any,month:string}){
 const [open,setOpen]=useState<string>('');
 const recs=s.attendance.filter(a=>a.employeeId===row.employeeId&&kdate(a.start).startsWith(month)).sort((a,b)=>a.start<b.start?-1:1);
 const total=recs.reduce((n,a)=>n+(a.end?worked(a):0),0);
 const Line=({l,kind}:{l:any,kind:string})=>{const k=kind+l.name;return <li><button className="basis-line" aria-expanded={open===k} onClick={()=>setOpen(open===k?'':k)}><span>{l.name}</span><b>{kind==='d'?'−':''}{won(l.amount)}원</b></button>{open===k&&<div className="basis-detail"><p>계산: {l.formula||'직접 입력'}</p>{kind==='e'&&/기본급|시급|주휴|연장|야간|휴일/.test(l.name)&&<p className="footnote">이 금액은 아래 출퇴근 기록 {recs.length}건(실근무 {total.toFixed(2)}시간)을 바탕으로 계산했어요.</p>}</div>}</li>};
 return <div className="pay-basis"><h3>지급 {won(row.gross)}원</h3><ul>{row.earnings.map((l:any)=><Line key={l.name} l={l} kind="e"/>)}</ul><h3>공제 {won(row.deduction)}원</h3><ul>{row.deductions.map((l:any)=><Line key={l.name} l={l} kind="d"/>)}{!row.deductions.length&&<li className="footnote">공제 없음</li>}</ul><p><b>실수령 {won(row.net)}원</b></p>
  <h3>{month} 출퇴근 기록 {recs.length}건 · 실근무 {total.toFixed(2)}시간</h3><div className="t-tablewrap"><table className="t-table"><thead><tr><th>날짜</th><th>출근</th><th>퇴근</th><th>휴게</th><th>실근무</th></tr></thead><tbody>{recs.map(a=><tr key={a.id}><td>{kdate(a.start)}</td><td>{clock(a.start)}</td><td>{a.end?clock(a.end):'퇴근 누락'}</td><td>{a.breakMinutes}분</td><td>{a.end?worked(a).toFixed(2)+'시간':'—'}</td></tr>)}</tbody></table>{!recs.length&&<p className="empty">이 달 출퇴근 기록이 없어요.</p>}</div>
  {(row.juhuSkipped||[]).length>0&&<p className="footnote">주휴수당 제외 주: {row.juhuSkipped.join(', ')} (결근 등)</p>}</div>
}
