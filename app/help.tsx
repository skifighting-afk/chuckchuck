'use client';
// 작업 100: 자주 묻는 질문 30개. 앱에 실제로 있는 기능만, 하지 않는 일은 하지 않는다고 쓴다.
import {useState} from 'react';
import {FAQ} from '../lib/faq';
export function Help(){
 const [q,setQ]=useState(()=>{try{return (new URLSearchParams(location.search).get('q')||'').slice(0,40)}catch{return ''}}),[open,setOpen]=useState<string>('');
 const k=q.trim();const groups=FAQ.map(g=>({...g,items:g.items.filter(i=>!k||(i.q+i.a).includes(k))})).filter(g=>g.items.length);
 return <main className="saas-policy help-page"><span className="saas-kicker">도움말</span><h1>자주 묻는 질문</h1><label className="saas-field">찾을 말<input type="search" value={q} placeholder="예: 대타, 연차, QR" onChange={e=>setQ(e.target.value)}/></label>
  {groups.map(g=><section key={g.group}><h2>{g.group}</h2>{g.items.map(i=><div className="help-item" key={i.q}><button aria-expanded={open===i.q||!!k} onClick={()=>setOpen(open===i.q?'':i.q)}>{i.q}</button>{(open===i.q||!!k)&&<div className="help-answer"><p>{i.a}</p>{i.link&&<a href={i.link[0]}>{i.link[1]} →</a>}</div>}</div>)}</section>)}
  {!groups.length&&<p>찾는 내용이 없어요. 다른 말로 찾아보세요.</p>}
  <section id="shortcuts" aria-labelledby="help-keys-title"><h2 id="help-keys-title">키보드 단축키(사장님 화면)</h2><ul><li><kbd>←</kbd> <kbd>→</kbd> 이전·다음 주(근무표), 날(출퇴근), 달(급여·리포트)</li><li><kbd>T</kbd> 오늘로</li><li><kbd>G</kbd> 다음 <kbd>H</kbd> 홈으로</li><li><kbd>?</kbd> 이 도움말</li><li>비서 입력창에서 <kbd>/</kbd>근무 · /출근 · /급여 · /휴가 · /할일 · /지각</li></ul><p>글을 입력하는 칸에 있을 때는 단축키가 작동하지 않아요.</p></section>
  <section className="help-experts" aria-labelledby="help-experts-title"><h2 id="help-experts-title">전문가에게 물어볼 곳 (무료)</h2><p>척척사장의 계산과 안내는 참고 자료예요. 내 상황에 맞는 판단이 필요하면 아래에 무료로 물어보세요.</p>
   <ul><li><b>노동·임금</b> 고용노동부 고객상담센터 <a href="tel:1350">1350</a> · 마을노무사(지방고용노동관서 무료 상담)</li><li><b>세금·원천징수</b> 국세청 세미래 콜센터 <a href="tel:126">126</a></li><li><b>4대보험</b> 국민연금 <a href="tel:1355">1355</a> · 건강보험 <a href="tel:1577-1000">1577-1000</a> · 근로복지공단(고용·산재) <a href="tel:1588-0075">1588-0075</a></li><li><b>최저임금</b> 최저임금위원회(minimumwage.go.kr)</li><li><b>소비자 분쟁</b> 한국소비자원 <a href="tel:1372">1372</a></li></ul>
   <p className="saas-fine">운영 시간: 평일 10:00~18:00(주말·공휴일 제외) · 첫 답변 3영업일 안 · <a href="/policy#o5">문의 처리 기준</a></p></section>
  <p className="saas-fine"><a href="/app">← 우리 매장으로</a></p><p className="help-more">찾는 답이 없나요? <a href="/support">문의하기 →</a></p></main>
}
