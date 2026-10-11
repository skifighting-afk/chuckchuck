import {useEffect} from 'react';
import {useStartGuide} from './start-guide-store';
const steps:Record<string,{title:string;body:string[]}>= {
 'manager-schedule':{title:'근무표 등록',body:['소속 매장의 직원을 고르세요. 다른 지점 직원은 사장님이 관리해요.','근무 날짜와 출근·퇴근 시간을 확인하세요.','휴게 시간을 입력하고 기존 근무·휴가와 겹치지 않는지 확인하세요.','입력 내용을 확인한 뒤 직접 근무 등록을 누르세요. 저장 결과가 나오면 등록된 근무에서 확인할 수 있어요.']},
 'manager-attendance':{title:'출퇴근 정정 확인',body:['수정 전·후 시간과 사유를 비교한 뒤 승인 또는 반려하세요. 본인 요청은 사장님이 확인해요.']},
 'manager-leave':{title:'휴가 신청 확인',body:['신청 기간·남은 휴가와 근무표를 확인하고 처리 사유를 적으세요. 확인 후 직접 승인 또는 반려해 주세요.']},
 'manager-notices':{title:'우리 지점 공지',body:['직원에게 전할 제목과 내용을 입력해 주세요.','수신 범위가 내 매장인지 확인하고 직접 공지 등록을 누르세요.']},
};
export function ManagerGuide(){
 const g=useStartGuide(),p=g.data?.preferences,a=p?.active,q=a&&steps[a.questId];
 useEffect(()=>{if(!a||!q)return;const el=document.getElementById('guide-'+a.questId);el?.scrollIntoView({block:'center',behavior:'smooth'});el?.focus({preventScroll:true})},[a?.questId]);
 if(!g.data)return <p role="status">맡은 업무의 시작 안내를 불러오고 있어요…</p>;
 if(p?.mini||p?.hideAll||Date.parse(p?.deferredUntil||'')>Date.now())return <button type="button" className="secondary" onClick={()=>void g.save({mini:false,hideAll:false,deferredUntil:null})}>매니저 시작 안내 다시 열기</button>;
 const ids=g.data.availableQuestIds.filter(id=>steps[id]);
 return <section className="auth-card manager-start-guide" aria-label="매니저 시작 안내"><h2>맡은 업무부터, 하나씩 시작해요.</h2><p>직원으로서의 내 근무·급여 안내는 <a href="/app">내 직원 화면</a>에 따로 있어요.</p>{!ids.length?<p>아직 맡은 관리 업무가 없어요. 사장님께 필요한 권한을 요청해 주세요.</p>:<nav aria-label="맡은 업무 안내">{ids.map(id=><button type="button" className="secondary" key={id} aria-pressed={a?.questId===id} onClick={()=>void g.save({active:{questId:id,step:0}})}>{steps[id].title}</button>)}</nav>}{a&&q&&<div role="status"><h3>{q.title} · {a.step+1}/{q.body.length}</h3><p>{q.body[a.step]}</p><div className="t-wrapactions">{a.step>0&&<button type="button" onClick={()=>void g.save({active:{questId:a.questId,step:a.step-1}})}>이전 안내</button>}<button type="button" onClick={()=>void g.save({active:a.step+1<q.body.length?{questId:a.questId,step:a.step+1}:null})}>{a.step+1<q.body.length?'다음 안내':'안내 마치기'}</button></div><small>안내를 넘겨도 업무는 저장되지 않아요. 아래 업무 화면에서 직접 처리해 주세요.</small></div>}<div className="t-wrapactions"><button type="button" onClick={()=>void g.save({mini:true})}>접기</button><button type="button" onClick={()=>void g.save({deferredUntil:new Date(Date.now()+86400000).toISOString()})}>내일 할게요</button></div></section>;
}
