// 임금명세서를 칸으로: 기본 정보 → 실지급액 → 지급 항목 표 → 공제 항목 표.
import {type PayslipView as View} from '../lib/payslip';
const w=(n:number)=>Math.round(n).toLocaleString('ko-KR');
export function PayslipView({v}:{v:View}){
 return <article className="slip" aria-label={v.title}>
  <header className="slip-head"><h3>{v.title}</h3><dl>{v.info.map(([k,x])=><div key={k}><dt>{k}</dt><dd>{x}</dd></div>)}</dl></header>
  <div className="slip-net"><span>실지급액</span><b>{w(v.net)}<small>원</small></b><span className="slip-calc">지급 {w(v.gross)}원 − 공제 {w(v.deduction)}원</span></div>
  <table className="slip-table"><caption>지급 항목</caption><thead><tr><th scope="col">항목</th><th scope="col">금액</th></tr></thead><tbody>{v.earnings.map((i,n)=><tr key={n}><th scope="row">{i.name}{i.formula&&<small>{i.formula}</small>}</th><td>{w(i.amount)}원</td></tr>)}</tbody><tfoot><tr><th scope="row">임금 총액</th><td>{w(v.gross)}원</td></tr></tfoot></table>
  <table className="slip-table deduct"><caption>공제 항목</caption><thead><tr><th scope="col">항목</th><th scope="col">금액</th></tr></thead><tbody>{v.deductions.length?v.deductions.map((i,n)=><tr key={n}><th scope="row">{i.name}{i.formula&&<small>{i.formula}</small>}</th><td>{w(i.amount)}원</td></tr>):<tr><th scope="row">공제 없음</th><td>0원</td></tr>}</tbody><tfoot><tr><th scope="row">공제 총액</th><td>{w(v.deduction)}원</td></tr></tfoot></table>
  {v.note&&<p className="slip-note"><b>비고</b> {v.note}</p>}
 </article>;
}
