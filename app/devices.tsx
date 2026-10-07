'use client';
// 작업 060: 로그인한 기기 목록과 모든 기기에서 로그아웃
import {useEffect,useState} from 'react';
export function DeviceSessions(){
 const [list,setList]=useState<any[]|null|undefined>(undefined),[error,setError]=useState('');
 useEffect(()=>{fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'sessions'})}).then(async r=>{const d:any=await r.json();if(!r.ok)throw Error(d.error);setList(d.sessions)}).catch(e=>setError(e.message||'기기 목록을 불러오지 못했어요.'))},[]);
 return <section className="panel devices" style={{padding:20,marginTop:16}}><h3>로그인한 기기</h3>{error&&<p className="saas-error">{error}</p>}
  {list===undefined&&!error&&<p>불러오는 중…</p>}
  {list===null&&<p className="footnote">기기 목록을 지금 볼 수 없어요. 다른 기기에서 로그인한 것 같다면 아래 버튼으로 모두 로그아웃하세요.</p>}
  {list&&<ul>{list.map((s,i)=><li key={i}><b>{s.device}</b><small>마지막 사용 {new Date(s.lastUsedAt).toLocaleString('ko-KR')} · 처음 로그인 {new Date(s.createdAt).toLocaleDateString('ko-KR')}</small></li>)}{!list.length&&<li>로그인한 기기가 없어요.</li>}</ul>}
  <p className="footnote">휴대폰을 잃어버렸거나 다른 사람이 쓴 것 같으면 모든 기기에서 로그아웃한 뒤 비밀번호를 바꿔 주세요.</p>
  <a className="saas-secondary" href="/logout?everywhere=1">모든 기기에서 로그아웃</a><LoginHistory/></section>
}

/** 지시서 098: 최근 로그인 기록(성공·실패) — 모르는 실패가 많으면 비밀번호를 바꾸세요 */
function LoginHistory(){
 const [ev,setEv]=useState<any[]|null>(null),[err,setErr]=useState('');
 const load=()=>fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'loginHistory'})}).then(async r=>{const d:any=await r.json();if(!r.ok)throw Error(d.error);setEv(d.events)}).catch(e=>setErr(e.message||'로그인 기록을 불러오지 못했어요. 새로고침해 주세요.'));
 const fails=(ev||[]).filter(x=>!x.ok&&Date.now()-Date.parse(x.at)<7*86400000).length;
 return <details className="login-hist" onToggle={e=>{if((e.target as HTMLDetailsElement).open&&!ev)void load()}}><summary>최근 로그인 기록</summary>{err&&<p className="saas-error">{err}</p>}
  {ev&&<>{fails>=3&&<p className="notice">최근 7일 동안 로그인 실패가 {fails}번 있었어요. 내가 아니라면 비밀번호를 바꿔 주세요.</p>}<ul>{ev.map((x,i)=><li key={i}><b className={x.ok?'':'slog-bad'}>{x.ok?'✓ 성공':'✕ 실패'}</b> {new Date(x.at).toLocaleString('ko-KR')} · {x.device||'알 수 없는 기기'} · {x.ip}</li>)}{!ev.length&&<li>아직 기록이 없어요(이 기능을 켠 뒤 로그인부터 남아요).</li>}</ul></>}</details>;
}
