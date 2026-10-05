// 가이드 98: 서비스 상태 안내(/status). 서버·DB 응답과 최근 서비스 안내를 보여 준다.
import {useEffect,useState} from 'react';
export function StatusPage(){
 const [s,setS]=useState<any>(null),[err,setErr]=useState(''),[build,setBuild]=useState<any>(null);
 const check=async()=>{setErr('');try{const r=await fetch('/api/status');const d=await r.json();setS({...d,ok:r.ok})}catch{setS(null);setErr('서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 확인해 주세요.')}};
 useEffect(()=>{check();fetch('/version.json').then(r=>r.json()).then(setBuild).catch(()=>{})},[]);
 const good=s?.ok&&s?.db;
 return <main className="saas-policy"><span className="saas-kicker">서비스 상태</span><h1>{s===null&&!err?'확인하고 있어요…':good?'정상 운영 중이에요':'일부 기능에 문제가 있어요'}</h1>
  {err&&<p className="saas-error" role="alert">{err}</p>}
  {s&&<ul className="status-list"><li><b>서버</b> {s.ok?'응답함':'응답 이상'} {typeof s.ms==='number'&&<small>({s.ms}ms)</small>}</li><li><b>데이터베이스</b> {s.db?'연결됨':'연결 안 됨'}</li>{build&&<li><b>화면 버전</b> {new Date(build.builtAt).toLocaleString('ko-KR')} 배포</li>}</ul>}
  <button type="button" className="saas-secondary" onClick={check}>다시 확인</button>
  <h2>최근 서비스 안내</h2>{s?.notices?.length?<ul>{s.notices.map((n:any)=><li key={n.title+n.effective_at}>{n.title} <small>· {String(n.effective_at||'').slice(0,10)} 적용</small></li>)}</ul>:<p>최근 안내가 없어요.</p>}
  <p className="saas-fine">문제가 계속되면 화면 아래 운영자 연락처로 알려 주세요. 오류 화면에 나온 오류 번호(E-로 시작)를 함께 알려 주시면 빨리 찾을 수 있어요.</p></main>;
}
