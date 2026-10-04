// 작업 056: 회원 탈퇴 화면
import {useEffect,useState} from 'react';
import {ExportStore} from './limits-note';

export function Withdraw(){
 const [info,setInfo]=useState<any>(null),[signedIn,setSignedIn]=useState<boolean|null>(null),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState('');
 const load=()=>fetch('/api/account').then(r=>r.ok?r.json():null).then(setInfo).catch(()=>setInfo(null));
 useEffect(()=>{fetch('/api/auth').then(r=>r.json()).then((d:any)=>{setSignedIn(!!d.authenticated);if(d.authenticated)load()}).catch(()=>setSignedIn(false))},[]);
 if(signedIn===false)return <main className="auth-card withdraw"><h1>회원 탈퇴</h1><p>탈퇴하려면 먼저 로그인해 주세요.</p><a className="saas-primary" href="/login?next=/withdraw">로그인</a></main>;
 const owner=info?.access==='owner'&&info?.onboarded,deletion=info?.account?.deletion;
 async function post(body:any){setBusy(true);setError('');try{const r=await fetch('/api/withdraw',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d:any=await r.json();if(!r.ok)throw Error(d.error);return d}catch(e){setError(e instanceof Error?e.message:'처리하지 못했어요.');return null}finally{setBusy(false)}}
 async function submit(e:React.FormEvent){e.preventDefault();const d=await post({action:'withdraw',password,confirm});setPassword('');if(!d)return;
  if(d.deleted){await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})}).catch(()=>null);setDone('탈퇴했어요. 그동안 이용해 주셔서 고마워요.');return}
  setDone(`탈퇴를 예약했어요. ${new Date(d.purgeAt).toLocaleDateString('ko-KR')}에 가게 데이터와 계정이 삭제돼요. 그 전에는 이 화면에서 취소할 수 있어요.`);load()}
 async function cancel(){const d=await post({action:'cancelWithdraw'});if(d){setDone('탈퇴 예약을 취소했어요. 다시 저장할 수 있어요.');load()}}
 return <main className="auth-card withdraw">
  <h1>회원 탈퇴</h1>
  {done&&<p role="status" className="saas-success">{done}</p>}
  {deletion?<><p>{new Date(deletion.purgeAt).toLocaleDateString('ko-KR')}에 가게 데이터·근로계약서·임금명세서·로그인 계정이 모두 삭제될 예정이에요. 지금 가게는 읽기 전용이에요.</p><button className="saas-primary" disabled={busy} onClick={cancel}>탈퇴 예약 취소</button></>:!done.startsWith('탈퇴했어요')&&<>
   {owner?<><p>사장님이 탈퇴하면 <b>30일 뒤</b> 가게의 모든 데이터(직원·근무·급여·근로계약서·임금명세서)와 로그인 계정이 삭제돼요. 30일 동안은 가게가 읽기 전용이 되고, 언제든 취소할 수 있어요.</p><p>근로계약서·임금대장 등은 근로기준법 제42조에 따라 사장님이 3년간 보존해야 해요. <b>탈퇴 전에 가게 데이터를 내려받아 보관해 주세요.</b> 최근 7일 안에 내려받아야 탈퇴를 예약할 수 있어요. 직원들도 탈퇴 예정일까지 자기 서류를 내려받을 수 있어요.</p><ExportStore/></>
   :<><p>탈퇴하면 로그인 계정이 바로 삭제되고, 일하던 가게와의 연결이 끊겨요. 가게에 남은 내 근무·급여 기록과 근로계약서는 사장님이 법에 따라 보관하는 서류라 함께 지워지지 않아요.</p><p><b>탈퇴 전에 <a href="/contracts">내 근로계약서</a>와 임금명세서를 내려받아 두세요.</b> 탈퇴 후에는 앱에서 다시 볼 수 없어요.</p></>}
   <form onSubmit={submit} className="withdraw-form"><label className="saas-field">현재 비밀번호<input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="saas-field">확인을 위해 '탈퇴'라고 입력해 주세요<input required value={confirm} onChange={e=>setConfirm(e.target.value)} aria-describedby="withdraw-warn"/></label><small id="withdraw-warn">{owner?'예약 후 30일이 지나면 되돌릴 수 없어요.':'바로 삭제되며 되돌릴 수 없어요.'}</small>{error&&<p role="alert" className="saas-error">{error}</p>}<button className="saas-primary withdraw-danger" disabled={busy||confirm!=='탈퇴'||!password}>{busy?'처리하고 있어요…':owner?'30일 뒤 삭제 예약':'지금 탈퇴하기'}</button></form>
  </>}
  {error&&deletion&&<p role="alert" className="saas-error">{error}</p>}
  <a href="/app">← 돌아가기</a>
 </main>;
}
