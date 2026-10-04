'use client';
// 작업 054: 직원 일괄 등록(엑셀 붙여넣기 → 미리보기 → 등록)
import {useState} from 'react';
import {Btn} from './team-ui';
import {type Team,won} from '../lib/team-model';
import {parseBulk,BULK_COLUMNS} from '../lib/bulk-members';
export function BulkMembers({s,branch,busy,update,done}:{s:Team,branch:string,busy:boolean,update:(s:Team,close?:boolean)=>Promise<any>,done:(m:string)=>void}){
 const [text,setText]=useState(''),employer=s.settings.employerName||'',workplace=[s.store.name,s.branches.find(b=>b.id===branch)?.name].filter((v,i,a)=>v&&a.indexOf(v)===i).join(' '),rows=text.trim()?parseBulk(text,branch,s.employees.map(e=>e.email),{workplace,employer}):[];
 const good=rows.filter(r=>r.member),bad=rows.filter(r=>r.errors.length),room=150-s.employees.length;
 return <>
  <p>엑셀·구글 시트에서 아래 순서의 열을 복사해 붙여 넣으세요. 첫 줄이 제목(이름…)이면 건너뛰어요.</p>
  <p className="footnote">{BULK_COLUMNS.join(' · ')} — 급여형태가 비면 시급, 이름·연락처·이메일·급여는 꼭 필요해요. 주 소정시간이 비면 시급 20시간·월급 40시간, 직무가 비면 홀로 넣고, 근무장소는 이 지점, 사업주는 설정의 이름으로 채워요. 상태는 '입사 준비'로 등록되니 근로조건을 확인한 뒤 재직으로 바꿔 주세요.</p>
  {!employer&&<p className="saas-error" role="alert">설정에서 사업주 이름을 먼저 입력해 주세요. 계약서에 들어가는 정보라 일괄 등록에 필요해요.</p>}
  <textarea className="bulk-input" rows={8} value={text} onChange={e=>setText(e.target.value)} placeholder={'김민지\t010-1234-5678\tminji@example.com\t2026-10-05\t시급\t10320\t20\t홀'} aria-label="직원 표 붙여넣기"/>
  {rows.length>0&&<div className="t-tablewrap"><table className="t-table bulk-preview"><thead><tr><th>줄</th><th>이름</th><th>급여</th><th>입사일</th><th>확인</th></tr></thead><tbody>{rows.map(r=><tr key={r.line} className={r.errors.length?'bad':''}><td>{r.line}</td><td>{r.member?.name||r.raw[0]||'—'}</td><td>{r.member?`${r.member.payType} ${won(r.member.wage)}원 · 주 ${r.member.weeklyHours}시간`:r.raw[5]||''}</td><td>{r.member?.joined||r.raw[3]||''}</td><td>{r.errors.length?<span className="bulk-err">{r.errors.join(' · ')}</span>:'등록 가능'}</td></tr>)}</tbody></table></div>}
  {good.length>room&&<p className="saas-error" role="alert">직원은 최대 150명까지라 {room}명만 더 등록할 수 있어요.</p>}
  <div className="actions"><Btn primary disabled={busy||!employer||!good.length||good.length>room} onClick={async()=>{if(await update({...s,employees:[...s.employees,...good.map(r=>r.member!)]}))done(`직원 ${good.length}명을 '입사 준비'로 등록했어요.${bad.length?` 오류 ${bad.length}줄은 고쳐서 다시 붙여 넣어 주세요.`:''}`)}}>{good.length}명 등록{bad.length?` (오류 ${bad.length}줄 제외)`:''}</Btn></div>
 </>
}
