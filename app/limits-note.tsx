import {useState} from 'react';
// 작업 019: 자동으로 하는 것과 하지 않는 것을 항상 같은 말로 보여 준다.
export function PayrollLimits(){
 return <div className="notice limits-note" role="note"><p><b>자동으로 계산하는 것</b> · 기본급(수습 감액 조건 확인), 주휴수당(주 15시간 이상), 5명 이상 사업장의 연장·야간·휴일(공휴일·근로자의 날·주휴일) 가산 — '법정수당 자동 계산'을 켠 직원(일급·월급은 통상시급으로). 원천징수 방식이 '4대보험 자동'인 직원은 4대보험 근로자 부담분(2026년 요율, '가입'으로 표시한 보험만, 비과세 수당 제외, 국민연금 상·하한 반영)과 근로소득세·지방소득세(2026 간이세액표).</p><p><b>직접 확인·입력할 것</b> · 공휴일 유급휴일 수당(쉬어도 주는 임금). 같은 이름으로 직접 입력하면 자동 값 대신 쓰여요.</p></div>
}
export function ContractLimits(){
 return <p className="footnote" role="note">앱 전자서명은 로그인한 계정과 현재 비밀번호 확인, 성명 입력으로 동의를 기록해요. 공인 인증서나 제3자 본인확인 서비스의 인증은 아니에요. 서명한 본문과 기록은 바꿀 수 없게 보관돼요.</p>
}

/** 작업 071: 가게 데이터 전체 내려받기 */
export function ExportStore(){
 const [busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 async function run(){setBusy(true);setMsg('');try{const r=await fetch('/api/export');if(!r.ok){const d:any=await r.json().catch(()=>({}));throw Error(d.error||'내려받지 못했어요.')}const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(r.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1])||'chukchuk-export.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);setMsg('파일을 내려받았어요. 근로계약서·임금명세서·출퇴근 기록은 3년간 보관해야 하니 안전한 곳에 두세요.')}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}}
 return <section className="panel" style={{padding:20,marginTop:16}}><h3>가게 데이터 전체 내려받기</h3><p className="footnote">직원·근무표·출퇴근·급여 확정 기록, 근로계약서와 서명 기록, 보낸 임금명세서를 한 파일(JSON)로 받아요. 근로기준법 제42조에 따라 계약서·임금 관련 서류는 3년 보존해야 해요.</p><button className="saas-secondary" disabled={busy} onClick={run}>{busy?'모으는 중…':'전체 데이터 내려받기'}</button>{msg&&<p role="status">{msg}</p>}</section>
}
