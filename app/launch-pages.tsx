'use client';
// 출시 준비: 개인정보 요청(/privacy-request) · 서비스 소식(/news) · 광고성 정보 수신 설정
import {useEffect,useState} from 'react';
import {RELEASE_NOTES} from '../lib/release-notes';

export function PrivacyRequest(){
 const rows:[string,string,string,string][]=[
  ['열람·내려받기','내 정보와 기록을 보거나 파일로 받기','사장님: 설정 → 가게 데이터 전체 내려받기 · 직원: 직원 화면의 "내 자료 내려받기"','/app'],
  ['정정','틀린 정보 고치기','사장님: 계정·설정에서 바로 · 직원: 내 정보 바꾸기(사장님 확인 뒤 반영)','/app'],
  ['삭제(탈퇴)','계정과 정보 지우기','내 계정 → 탈퇴(사장님은 30일 뒤 삭제, 그 전에 취소 가능)','/withdraw'],
  ['처리정지·동의 철회','알림·광고성 정보 받지 않기','내 계정 → 알림 끄기 · 광고성 정보 수신 끄기','/withdraw'],
  ['그 밖의 요청','위로 안 되는 요청, 직원이 회사에 직접 요청','문의하기 → 개인정보 요청(10일 안에 처리)','/support?category=개인정보 요청'],
 ];
 return <main className="saas-policy"><span className="saas-kicker">개인정보</span><h1>개인정보 요청</h1>
  <p>내 개인정보를 보거나, 고치거나, 지우거나, 처리를 멈춰 달라고 언제든 요청할 수 있어요(개인정보 보호법 제35~37조). 요청을 받으면 10일 안에 처리하거나, 처리할 수 없는 이유를 알려 드려요.</p>
  <div className="legal-table" role="region" aria-label="요청 방법 표" tabIndex={0}><table><thead><tr><th scope="col">요청</th><th scope="col">무엇을</th><th scope="col">어떻게</th></tr></thead><tbody>{rows.map(([a,b,c,h])=><tr key={a}><td><b>{a}</b></td><td>{b}</td><td><a href={h}>{c}</a></td></tr>)}</tbody></table></div>
  <h2>직원이라면</h2><p>근무·급여 기록은 사장님이 관리하는 정보예요. 먼저 사장님께 요청하고, 사장님께 말하기 어렵다면 회사(문의하기 → 개인정보 요청)에 요청해 주세요. 지체 없이 사장님께 전달하고 처리를 도와요.</p>
  <h2>본인 확인</h2><p>로그인한 계정으로 요청하면 따로 서류를 받지 않아요. 로그인할 수 없으면 비밀번호 찾기로 계정을 되찾은 뒤 요청해 주세요. 다른 사람이 대신 요청할 때는 위임장이 필요해요.</p>
  <p className="saas-fine">처리 기록은 3년 동안 남겨요. 개인정보 침해 신고는 개인정보침해신고센터(국번 없이 118)에도 할 수 있어요. <a href="/privacy#p8">처리방침 8항 보기</a></p></main>;
}

export function NewsPage(){
 return <main className="saas-policy"><span className="saas-kicker">서비스 소식</span><h1>새로 나온 기능</h1><p>척척사장에 더해진 기능과 바뀐 점을 날짜순으로 알려 드려요. 약관·처리방침이 바뀔 때는 적용 7일 전(불리한 변경은 30일 전)에 따로 알려요.</p>
  {RELEASE_NOTES.map(n=><section key={n.date} className="news-item"><h2>{n.date} · {n.title}</h2><ul>{n.items.map(i=><li key={i}>{i}</li>)}</ul></section>)}
  <p className="saas-fine"><a href="/status">서비스 상태</a> · <a href="/help">자주 묻는 질문</a></p></main>;
}

/** 광고성 정보 수신(선택) — 바꾸면 시각을 보여 준다(정보통신망법 제50조 제8항: 처리 결과 알림) */
export function MarketingToggle(){
 const [st,setSt]=useState<any>(null),[err,setErr]=useState('');
 const call=async(on?:boolean)=>{setErr('');try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'marketing',...(on===undefined?{}:{on})})});const d:any=await r.json();if(!r.ok)throw Error(d.error);setSt(d)}catch(e){setErr((e as Error).message||'불러오지 못했어요.')}};
 useEffect(()=>{void call()},[]);
 return <section className="panel devices" style={{padding:20,marginTop:16}}><h3>광고성 정보 수신 (선택)</h3>
  {st&&<><label className="t-check"><input type="checkbox" checked={st.on} onChange={e=>call(e.target.checked)}/> 새 기능·할인 소식 받기</label>
   {st.changedAt&&<p role="status" className="saas-success">{new Date(st.changedAt).toLocaleString('ko-KR')}에 수신 {st.on?'동의':'거부'}로 바꿨어요.</p>}
   <p className="footnote">{st.on&&st.since?`${new Date(st.since).toLocaleDateString('ko-KR')}에 동의했어요. 2년마다 다시 확인해요. `:''}서비스 안내(급여 확정, 계약 서명, 보안 알림)는 이 설정과 관계없이 보내요.</p></>}
  {err&&<p className="saas-error" role="alert">{err}</p>}</section>;
}
