'use client';
// 척척 비서: 화면마다 '지금 볼 것'(가게 기록으로 계산) + 쓰는 법 + 질문 검색(자주 묻는 질문).
import {useMemo,useState} from 'react';
import {type Team,today} from '../lib/team-model';
import {assistantBrief,searchAnswers} from '../lib/assistant';
import {type Target} from '../lib/close-check';

export function Assistant({state,branch,page,help,go,home=false}:{state:Team,branch:string,page:string,help?:string,go:(t:Target)=>void,home?:boolean}){
 const brief=useMemo(()=>assistantBrief(state,branch,page,today()),[state,branch,page]);
 const [q,setQ]=useState(''),[answers,setAnswers]=useState<{q:string,a:string,link?:[string,string]}[]|null>(null),[asked,setAsked]=useState('');
 const urgent=brief.filter(b=>b.tone==='red'||b.tone==='amber').length;
 const ask=async(e:React.FormEvent)=>{e.preventDefault();const k=q.trim();if(!k)return;const {FAQ}=await import('../lib/faq');setAsked(k);setAnswers(searchAnswers(FAQ.flatMap(g=>g.items),k))};
 const target:Record<Target,string>={attendance:'출퇴근 기록',employees:'직원 관리',operations:'휴가·공지',contracts:'근로계약서',payroll:'급여·명세서',schedule:'근무 스케줄',reports:'인건비 리포트'};
 return <details className={'assistant'+(home?' home':'')} open={home||urgent>0||undefined}>
  <summary><img src="/cheokcheoki-guide.png" alt="" width="40" height="40"/><span><b>척척 비서</b><small>{urgent?`지금 확인할 것 ${urgent}건`:'가게 기록을 읽고 알려 드려요'}</small></span></summary>
  <div className="assistant-body">
   <ul className="assistant-brief">{brief.map((b,i)=><li key={i} className={b.tone||''}><span>{b.text}</span>{b.target&&target[b.target]!==page&&<button type="button" onClick={()=>go(b.target!)}>{target[b.target]} 열기</button>}</li>)}</ul>
   {help&&<details className="assistant-help"><summary>이 화면 쓰는 법</summary><p>{help}</p></details>}
   <form className="assistant-ask" onSubmit={ask}><label htmlFor={'ask-'+page} className="sr-only">비서에게 물어보기</label><input id={'ask-'+page} type="search" value={q} onChange={e=>{setQ(e.target.value);if(!e.target.value)setAnswers(null)}} placeholder="물어보세요 · 예: 주휴수당, 대타, QR 잘못 찍음"/><button type="submit">묻기</button></form>
   {answers&&<div className="assistant-answers" role="status">{answers.length?answers.map(a=><article key={a.q}><b>{a.q}</b><p>{a.a}</p>{a.link&&<a href={a.link[0]}>{a.link[1]}</a>}</article>):<p>‘{asked}’에 맞는 답을 찾지 못했어요. 다른 말로 물어보거나 <a href="/support">문의하기</a>로 남겨 주세요.</p>}</div>}
  </div>
 </details>;
}
