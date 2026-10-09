// 작업 013·014·015: 이용약관·개인정보 처리방침 화면과 화면 아래 운영자 정보
import {ArrowLeft} from 'lucide-react';
import {TERMS,PRIVACY,POLICY,ACCESSIBILITY,type LegalDoc} from '../lib/legal-docs';
import {OperatorInfo} from './operator-footer';

const REPO='https://github.com/skifighting-afk/chuckchuck';
export function LegalPage({privacy,doc}:{privacy?:boolean,doc?:'policy'|'accessibility'}){
 const d:LegalDoc=doc==='policy'?POLICY:doc==='accessibility'?ACCESSIBILITY:privacy?PRIVACY:TERMS;
 return <main className="saas-policy legal-doc">
  <span className="saas-kicker">{doc==='policy'?'운영정책':doc==='accessibility'?'접근성':privacy?'개인정보':'이용약관'}</span><h1>{d.title}</h1>
  <p className="legal-meta">판 {d.version} · 시행일 {d.effective} · <a href={privacy?'/terms':'/privacy'}>{privacy?'이용약관 보기':'개인정보 처리방침 보기'}</a>{' · '}<a href="/policy">운영정책</a>{' · '}<a href="/refund">환불 규정</a></p>
  {!d.reviewed&&<p className="auth-note" role="note">법률 검토 전 초안이에요. 운영자 정보와 결제 서비스를 확정하고 검토를 마치면 정식판으로 바꾸고, 바뀐 내용은 다음 로그인 때 다시 동의받아요.</p>}
  <nav className="legal-toc" aria-label="목차"><ol>{d.sections.map(s=><li key={s.id}><a href={'#'+s.id}>{s.title}</a></li>)}</ol></nav>
  {d.sections.map(s=><section key={s.id} id={s.id}><h2>{s.title}</h2>{s.body.map((b,i)=>typeof b==='string'
   ?(b.startsWith('- ')?<p key={i} className="legal-bullet">· {b.slice(2)}</p>:<p key={i}>{b}</p>)
   :<div key={i} className="legal-table" role="region" aria-label={s.title+' 표'} tabIndex={0}><table><thead><tr>{b.rows[0].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{b.rows.slice(1).map((r,j)=><tr key={j}>{r.map((c,k)=><td key={k}>{c}</td>)}</tr>)}</tbody></table></div>)}</section>)}
  <section id="history"><h2>이전 판</h2><ul>{d.history.map(h=><li key={h.version}>{h.version} (시행 {h.effective}) · {h.note}</li>)}</ul><p className="saas-fine">고친 기록 전체: <a href={`${REPO}/commits/main/docs/legal/${d.key}.md`} target="_blank" rel="noopener">문서 변경 이력</a></p></section>
  <section id="operator"><h2>운영자 정보</h2><OperatorInfo/></section>
  <a href="/start" className="saas-back"><ArrowLeft size={16}/> 처음 화면으로</a>
 </main>;
}
