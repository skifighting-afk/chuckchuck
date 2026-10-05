'use client';
// 작업 100: 자주 묻는 질문 30개. 앱에 실제로 있는 기능만, 하지 않는 일은 하지 않는다고 쓴다.
import {useState} from 'react';
import {FAQ} from '../lib/faq';
export function Help(){
 const [q,setQ]=useState(''),[open,setOpen]=useState<string>('');
 const k=q.trim();const groups=FAQ.map(g=>({...g,items:g.items.filter(i=>!k||(i.q+i.a).includes(k))})).filter(g=>g.items.length);
 return <main className="saas-policy help-page"><span className="saas-kicker">도움말</span><h1>자주 묻는 질문</h1><label className="saas-field">찾을 말<input type="search" value={q} placeholder="예: 대타, 연차, QR" onChange={e=>setQ(e.target.value)}/></label>
  {groups.map(g=><section key={g.group}><h2>{g.group}</h2>{g.items.map(i=><div className="help-item" key={i.q}><button aria-expanded={open===i.q||!!k} onClick={()=>setOpen(open===i.q?'':i.q)}>{i.q}</button>{(open===i.q||!!k)&&<div className="help-answer"><p>{i.a}</p>{i.link&&<a href={i.link[0]}>{i.link[1]} →</a>}</div>}</div>)}</section>)}
  {!groups.length&&<p>찾는 내용이 없어요. 다른 말로 찾아보세요.</p>}
  <p className="saas-fine"><a href="/app">← 우리 매장으로</a></p><p className="help-more">찾는 답이 없나요? <a href="/support">문의하기 →</a></p></main>
}
