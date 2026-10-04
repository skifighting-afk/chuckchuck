// 작업 022: 임금대장 화면. 확정한 급여를 연도별로 모아 보여 주고 CSV로 내려받는다.
import {useMemo,useState} from 'react';
import {Download} from 'lucide-react';
import {wageLedger,ledgerCsv} from '../lib/wage-ledger';
import {saveFile,Btn} from './team-ui';

const won=(v:number)=>Math.round(v).toLocaleString('ko-KR');

export function WageLedger({state,branch,branchName}:{state:any,branch:string,branchName:string}){
 const years=useMemo(()=>{const ys=new Set<string>(Object.values<any>(state.payrollRuns||{}).map(r=>String(r?.month||'').slice(0,4)).filter(Boolean));ys.add(String(new Date().getFullYear()));return [...ys].sort().reverse()},[state.payrollRuns]);
 const [year,setYear]=useState(years[0]),[all,setAll]=useState(false);
 const entries=useMemo(()=>wageLedger(state,year+'-01',year+'-12',all?undefined:branch),[state,year,branch,all]);
 const total=entries.reduce((n,e)=>n+e.gross,0);
 return <section className="panel wage-ledger" aria-labelledby="wage-ledger-title">
  <div className="t-toolbar"><h3 id="wage-ledger-title">임금대장</h3><select aria-label="임금대장 연도" value={year} onChange={e=>setYear(e.target.value)}>{years.map(y=><option key={y} value={y}>{y}년</option>)}</select>{(state.branches?.length||1)>1&&<label className="wage-ledger-all"><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/> 모든 지점</label>}<div className="t-grow"/><Btn disabled={!entries.length} onClick={()=>saveFile(`임금대장-${year}${all?'':'-'+branchName}.csv`,ledgerCsv(entries),'text/csv;charset=utf-8')}><Download size={16}/> CSV 내려받기</Btn></div>
  <p className="footnote">확정한 급여만 올라가요. 임금대장은 근로기준법 제48조에 따라 작성하고, 마지막 기재일부터 3년간 보존해야 합니다(제42조). 이 화면과 CSV는 기록 보관을 돕는 자료이며, 신고·제출 서식은 세무사와 확인해 주세요.</p>
  {entries.length?<div className="t-tablewrap"><table className="t-table"><caption className="sr-only">{year}년 임금대장</caption><thead><tr>{['급여월','직원','입사일·업무','근로','지급 내역','공제 내역','실지급액'].map(v=><th key={v} scope="col">{v}</th>)}</tr></thead><tbody>{entries.map(e=><tr key={e.month+e.branch+e.employeeId}><td><b>{e.month}</b><small>지급일 {e.payDate}</small>{e.status!=='확정'&&<small className="t-warn">{e.status}</small>}{all&&<small>{e.branchName}</small>}</td><td><b>{e.name}</b><small>직원번호 {e.number}</small></td><td><small>{e.joined} 입사</small><small>{e.duty||'업무 미입력'}</small><small>{e.payBasis}</small></td><td><small>{e.days}일 · {e.hours}시간</small>{e.overtimeHours>0&&<small>연장 {e.overtimeHours}시간</small>}{e.nightHours>0&&<small>야간 {e.nightHours}시간</small>}{e.holidayHours>0&&<small>휴일 {e.holidayHours}시간</small>}</td><td>{e.earnings.map((i,k)=><small key={k}>{i.name} {won(i.amount)}원</small>)}<b>합계 {won(e.gross)}원</b></td><td>{e.deductions.length?e.deductions.map((i,k)=><small key={k}>{i.name} {won(i.amount)}원</small>):<small>공제 없음</small>}<b>합계 {won(e.deduction)}원</b></td><td><b className="t-green">{won(e.net)}원</b></td></tr>)}</tbody></table></div>:<p>{year}년에 확정한 급여가 아직 없어요. 급여를 검토하고 확정하면 여기에 쌓여요.</p>}
  {entries.length>0&&<p className="footnote">{year}년 {entries.length}건 · 임금 총액 {won(total)}원</p>}
 </section>;
}
